// Order status state machine for laundry service

export type OrderStatus =
  | 'draft'
  | 'scheduled'
  | 'en_route_pickup'
  | 'picked_up'
  | 'processing'
  | 'ready_for_delivery'
  | 'en_route_delivery'
  | 'delivered'
  | 'completed'
  | 'canceled_by_customer'
  | 'canceled_by_ops'
  | 'no_show'
  | 'issue_flagged';

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