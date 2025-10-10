/**
 * Order Helper Functions
 *
 * Business logic for order operations.
 * Status values are defined here for future implementation.
 * Currently only 'scheduled' is used in the database, but this defines
 * the full order lifecycle for when status tracking is implemented.
 */

/**
 * Valid order status values
 * Define the complete order lifecycle
 */
export const ORDER_STATUSES = {
  // Initial states
  SCHEDULED: 'scheduled',           // Order created, waiting for pickup (CURRENT DEFAULT)
  CONFIRMED: 'confirmed',           // Order confirmed by operations (FUTURE)

  // In-progress states
  PICKED_UP: 'picked_up',          // Driver picked up laundry (FUTURE)
  IN_PROGRESS: 'in_progress',      // Being washed/processed (FUTURE)
  READY_FOR_DELIVERY: 'ready_for_delivery', // Clean and ready (FUTURE)
  OUT_FOR_DELIVERY: 'out_for_delivery',     // Driver delivering (FUTURE)

  // Final states
  DELIVERED: 'delivered',           // Successfully delivered (FUTURE)
  COMPLETED: 'completed',           // Order complete, payment settled (FUTURE)
  CANCELLED: 'cancelled',           // Order cancelled (FUTURE)
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

/**
 * Check if order is in an active (non-final) state
 */
export function isOrderActive(status: string): boolean {
  const activeStatuses = [
    ORDER_STATUSES.SCHEDULED,
    ORDER_STATUSES.CONFIRMED,
    ORDER_STATUSES.PICKED_UP,
    ORDER_STATUSES.IN_PROGRESS,
    ORDER_STATUSES.READY_FOR_DELIVERY,
    ORDER_STATUSES.OUT_FOR_DELIVERY,
  ];

  return activeStatuses.includes(status);
}

/**
 * Check if order is completed (final state)
 */
export function isOrderCompleted(status: string): boolean {
  return status === ORDER_STATUSES.COMPLETED || status === ORDER_STATUSES.DELIVERED;
}

/**
 * Check if order is cancelled
 */
export function isOrderCancelled(status: string): boolean {
  return status === ORDER_STATUSES.CANCELLED;
}

/**
 * Check if pickup is upcoming (scheduled for future date)
 */
export function isPickupUpcoming(status: string, pickupDate: string): boolean {
  if (status !== ORDER_STATUSES.SCHEDULED && status !== ORDER_STATUSES.CONFIRMED) {
    return false;
  }

  const pickup = new Date(pickupDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return pickup >= today;
}

/**
 * Get order progress percentage (0-100)
 * Visual indicator for customer dashboard
 */
export function getOrderProgress(status: string): number {
  const progressMap: Record<string, number> = {
    [ORDER_STATUSES.SCHEDULED]: 10,
    [ORDER_STATUSES.CONFIRMED]: 20,
    [ORDER_STATUSES.PICKED_UP]: 40,
    [ORDER_STATUSES.IN_PROGRESS]: 60,
    [ORDER_STATUSES.READY_FOR_DELIVERY]: 75,
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: 90,
    [ORDER_STATUSES.DELIVERED]: 100,
    [ORDER_STATUSES.COMPLETED]: 100,
    [ORDER_STATUSES.CANCELLED]: 0,
  };

  return progressMap[status] || 0;
}

/**
 * Check if customer can cancel the order
 * Business rule: Can cancel up to 6 hours before pickup
 */
export function canCancelOrder(status: string, pickupDate: string): boolean {
  // Can't cancel if already picked up or beyond
  if (!isOrderActive(status)) {
    return false;
  }

  if (status === ORDER_STATUSES.PICKED_UP || status === ORDER_STATUSES.IN_PROGRESS) {
    return false;
  }

  // Check if pickup is more than 6 hours away
  const pickup = new Date(pickupDate);
  const now = new Date();
  const hoursDifference = (pickup.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursDifference > 6;
}

/**
 * Check if customer can reschedule the order
 * Same rules as cancellation for now
 */
export function canRescheduleOrder(status: string, pickupDate: string): boolean {
  return canCancelOrder(status, pickupDate);
}

/**
 * Calculate order total from cent values
 */
export function calculateOrderTotal(order: {
  subtotal_cents?: number | null;
  rush_fee_cents?: number | null;
  taxes_cents?: number | null;
  discounts_cents?: number | null;
}): number {
  const subtotal = order.subtotal_cents || 0;
  const rushFee = order.rush_fee_cents || 0;
  const taxes = order.taxes_cents || 0;
  const discounts = order.discounts_cents || 0;

  return subtotal + rushFee + taxes - discounts;
}

/**
 * Convert cents to dollar string
 */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get CSS classes for order status badge
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    [ORDER_STATUSES.SCHEDULED]: 'bg-yellow-100 text-yellow-800',
    [ORDER_STATUSES.CONFIRMED]: 'bg-blue-100 text-blue-800',
    [ORDER_STATUSES.PICKED_UP]: 'bg-purple-100 text-purple-800',
    [ORDER_STATUSES.IN_PROGRESS]: 'bg-indigo-100 text-indigo-800',
    [ORDER_STATUSES.READY_FOR_DELIVERY]: 'bg-teal-100 text-teal-800',
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: 'bg-cyan-100 text-cyan-800',
    [ORDER_STATUSES.DELIVERED]: 'bg-green-100 text-green-800',
    [ORDER_STATUSES.COMPLETED]: 'bg-green-100 text-green-800',
    [ORDER_STATUSES.CANCELLED]: 'bg-gray-100 text-gray-800',
  };

  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get user-friendly status label
 */
export function getStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    [ORDER_STATUSES.SCHEDULED]: 'Scheduled',
    [ORDER_STATUSES.CONFIRMED]: 'Confirmed',
    [ORDER_STATUSES.PICKED_UP]: 'Picked Up',
    [ORDER_STATUSES.IN_PROGRESS]: 'In Progress',
    [ORDER_STATUSES.READY_FOR_DELIVERY]: 'Ready',
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: 'Out for Delivery',
    [ORDER_STATUSES.DELIVERED]: 'Delivered',
    [ORDER_STATUSES.COMPLETED]: 'Completed',
    [ORDER_STATUSES.CANCELLED]: 'Cancelled',
  };

  return labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Get order status category for grouping
 */
export function getOrderStatusCategory(status: string): 'active' | 'completed' | 'cancelled' {
  if (isOrderCancelled(status)) return 'cancelled';
  if (isOrderCompleted(status)) return 'completed';
  return 'active';
}

/**
 * Get next action text for customer
 */
export function getNextAction(status: string): string {
  const actionMap: Record<string, string> = {
    [ORDER_STATUSES.SCHEDULED]: 'Waiting for pickup',
    [ORDER_STATUSES.CONFIRMED]: 'Confirmed - pickup scheduled',
    [ORDER_STATUSES.PICKED_UP]: 'Being processed',
    [ORDER_STATUSES.IN_PROGRESS]: 'Being cleaned',
    [ORDER_STATUSES.READY_FOR_DELIVERY]: 'Ready for delivery',
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: 'Out for delivery',
    [ORDER_STATUSES.DELIVERED]: 'Delivered',
    [ORDER_STATUSES.COMPLETED]: 'Completed',
    [ORDER_STATUSES.CANCELLED]: 'Cancelled',
  };

  return actionMap[status] || 'Processing';
}

/**
 * Sort orders by pickup date (most recent first)
 */
export function sortOrdersByDate<T extends { pickup_date: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const dateA = new Date(a.pickup_date).getTime();
    const dateB = new Date(b.pickup_date).getTime();
    return dateB - dateA; // Descending (most recent first)
  });
}

/**
 * Format order ID for display (show first 8 characters)
 */
export function formatOrderId(id: string): string {
  return `#${id.slice(0, 8)}`;
}
