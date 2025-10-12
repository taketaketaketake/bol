// Order status state machine for laundry service

// Type-safe enum that mirrors database constraints
export const ORDER_STATUSES = [
  'draft',
  'scheduled', 
  'en_route_pickup',
  'picked_up',
  'processing',
  'ready_for_delivery',
  'en_route_delivery', 
  'delivered',
  'completed',
  'canceled_by_customer',
  'canceled_by_ops',
  'no_show',
  'issue_flagged'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export type StatusTransition = {
  from: OrderStatus;
  to: OrderStatus;
  trigger: string;
  notifications?: ('email' | 'sms')[];
  requiresData?: string[];
};

export const ORDER_STATUS_MACHINE: StatusTransition[] = [
  // Normal flow
  { from: 'draft', to: 'scheduled', trigger: 'payment_confirmed', notifications: ['email', 'sms'] },
  { from: 'scheduled', to: 'en_route_pickup', trigger: 'driver_dispatched', notifications: ['sms'] },
  { from: 'en_route_pickup', to: 'picked_up', trigger: 'items_collected', requiresData: ['actual_weight'] },
  { from: 'picked_up', to: 'processing', trigger: 'arrived_at_facility' },
  { from: 'processing', to: 'ready_for_delivery', trigger: 'cleaning_completed' },
  { from: 'ready_for_delivery', to: 'en_route_delivery', trigger: 'out_for_delivery', notifications: ['sms'] },
  { from: 'en_route_delivery', to: 'delivered', trigger: 'items_delivered', notifications: ['email'] },
  { from: 'delivered', to: 'completed', trigger: 'payment_finalized' },

  // Side paths
  { from: 'scheduled', to: 'canceled_by_customer', trigger: 'customer_cancellation' },
  { from: 'scheduled', to: 'no_show', trigger: 'pickup_missed' },
  { from: 'processing', to: 'issue_flagged', trigger: 'damage_reported' },
];

export function getValidTransitions(currentStatus: OrderStatus): StatusTransition[] {
  return ORDER_STATUS_MACHINE.filter(t => t.from === currentStatus);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_MACHINE.some(t => t.from === from && t.to === to);
}

export function getStatusDisplay(status: OrderStatus): { label: string; color: string; description: string } {
  const statusMap = {
    'draft': { label: 'Draft', color: 'gray', description: 'Order being created' },
    'scheduled': { label: 'Scheduled', color: 'blue', description: 'Pickup scheduled' },
    'en_route_pickup': { label: 'En Route', color: 'yellow', description: 'Driver heading to pickup' },
    'picked_up': { label: 'Picked Up', color: 'orange', description: 'Items collected' },
    'processing': { label: 'Processing', color: 'purple', description: 'Being cleaned' },
    'ready_for_delivery': { label: 'Ready', color: 'green', description: 'Ready for delivery' },
    'en_route_delivery': { label: 'Out for Delivery', color: 'blue', description: 'On the way back' },
    'delivered': { label: 'Delivered', color: 'green', description: 'Items delivered' },
    'completed': { label: 'Completed', color: 'gray', description: 'Order complete' },
    'canceled_by_customer': { label: 'Cancelled', color: 'red', description: 'Customer cancelled' },
    'canceled_by_ops': { label: 'Cancelled', color: 'red', description: 'Operations cancelled' },
    'no_show': { label: 'No Show', color: 'red', description: 'Customer unavailable' },
    'issue_flagged': { label: 'Issue', color: 'red', description: 'Requires attention' },
  };

  return statusMap[status] || { label: status, color: 'gray', description: 'Unknown status' };
}

// =========================================================================
// SHARED DRIVER WORKFLOW UTILITIES
// ⚠️ SERVER-SIDE ONLY - Import these in API routes, not client code
// =========================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Runtime check to ensure this runs server-side only
if (typeof window !== 'undefined') {
  throw new Error('order-status.ts updateOrderStatus functions must only be used server-side');
}

// Cached service client to avoid re-instantiation
let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }
    serviceClient = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return serviceClient;
}

/**
 * Log status change to audit trail
 * ⚠️ SERVER-SIDE ONLY
 */
async function logStatusChange(
  orderId: string, 
  newStatus: OrderStatus, 
  userId: string, 
  changedAt: string
): Promise<void> {
  const client = getServiceClient();
  
  const { error } = await client
    .from('order_status_history')
    .insert({
      order_id: orderId,
      status: newStatus,
      changed_by: userId,
      changed_at: changedAt
    });

  if (error) {
    console.error('[logStatusChange] Audit log error:', error);
    // Not fatal - don't throw
  }
}

export interface UpdateOrderStatusOptions {
  orderId: string;
  newStatus: OrderStatus;
  userId: string; // Driver/admin who made the change
  additionalData?: Record<string, any>; // Extra fields to update (photos, weights, etc.)
  skipValidation?: boolean; // For admin overrides
}

export interface UpdateOrderStatusResult {
  success: boolean;
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
  error?: string;
  validTransition?: string;
}

/**
 * Centralized order status update with validation and audit logging
 * ⚠️ SERVER-SIDE ONLY
 */
export async function updateOrderStatus(options: UpdateOrderStatusOptions): Promise<UpdateOrderStatusResult> {
  const { orderId, newStatus, userId, additionalData = {}, skipValidation = false } = options;
  const updatedAt = new Date().toISOString();
  const client = getServiceClient();

  try {
    // 1️⃣ Retrieve current order
    const { data: order, error: fetchError } = await client
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return {
        success: false,
        orderId,
        status: newStatus,
        updatedAt,
        error: 'Order not found'
      };
    }

    // 2️⃣ Validate status transition (unless skipped for admin override)
    if (!skipValidation && !canTransition(order.status as OrderStatus, newStatus)) {
      const validTransitions = getValidTransitions(order.status as OrderStatus)
        .map(t => `${t.from} → ${t.to}`)
        .join(', ');

      return {
        success: false,
        orderId,
        status: order.status as OrderStatus,
        updatedAt,
        error: `Invalid status transition: ${order.status} → ${newStatus}`,
        validTransition: validTransitions
      };
    }

    // 3️⃣ Update order with new status + additional data
    const updateData = {
      status: newStatus,
      ...additionalData
      // Skip updated_at since we have database trigger
    };

    const { error: updateError } = await client
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('[updateOrderStatus] Update error:', updateError);
      return {
        success: false,
        orderId,
        status: order.status as OrderStatus,
        updatedAt,
        error: 'Failed to update order status'
      };
    }

    // 4️⃣ Log audit trail
    await logStatusChange(orderId, newStatus, userId, updatedAt);

    return {
      success: true,
      orderId,
      status: newStatus,
      updatedAt
    };

  } catch (error) {
    console.error('[updateOrderStatus] Fatal error:', error);
    return {
      success: false,
      orderId,
      status: newStatus,
      updatedAt,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validate if a status transition is allowed
 * @param currentStatus - Current order status
 * @param targetStatus - Desired new status
 * @returns Validation result with error details if invalid
 */
export function validateStatusTransition(
  currentStatus: OrderStatus, 
  targetStatus: OrderStatus
): { valid: boolean; error?: string; validTransitions?: string[] } {
  
  if (canTransition(currentStatus, targetStatus)) {
    return { valid: true };
  }

  const validTransitions = getValidTransitions(currentStatus).map(t => t.to);
  
  return {
    valid: false,
    error: `Invalid transition: ${currentStatus} → ${targetStatus}`,
    validTransitions
  };
}