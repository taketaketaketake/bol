/**
 * Laundromat Dashboard Data Layer
 * 
 * Provides all data needed for laundromat operations dashboard
 */

import type { Order, Laundromat } from '../../db/schema';
import { getServiceClient } from '../order-status';

interface OrderWithCustomer extends Order {
  customer?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
}

interface OrdersByStatus {
  pickupQueue: OrderWithCustomer[];
  processing: OrderWithCustomer[];
  readyForDelivery: OrderWithCustomer[];
  outForDelivery: OrderWithCustomer[];
  onTrack: number;
  atRisk: number;
  late: number;
}

interface TodayStats {
  totalOrders: number;
  completedOrders: number;
  totalWeight: number;
  averageWeight: number;
}

interface LaundromatOperationsData {
  laundromat: Laundromat | null;
  todayOrders: OrderWithCustomer[];
  ordersByStatus: OrdersByStatus;
  todayStats: TodayStats;
  revenueToday: number;
}

/**
 * Get comprehensive operations data for a laundromat
 */
export async function getLaundromatOperationsData(authUserId: string): Promise<LaundromatOperationsData> {
  const serviceClient = getServiceClient();

  // Get the first active laundromat for development
  const { data: laundromats } = await serviceClient
    .from('laundromats')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (!laundromats || laundromats.length === 0) {
    return {
      laundromat: null,
      todayOrders: [],
      ordersByStatus: {
        pickupQueue: [],
        processing: [],
        readyForDelivery: [],
        outForDelivery: [],
        onTrack: 0,
        atRisk: 0,
        late: 0
      },
      todayStats: {
        totalOrders: 0,
        completedOrders: 0,
        totalWeight: 0,
        averageWeight: 0
      },
      revenueToday: 0
    };
  }

  const laundromat = laundromats[0];
  const laundromatId = laundromat.id;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Parallel data fetching for optimal performance
  const [
    todayOrdersResult,
    revenueResult
  ] = await Promise.all([
    getTodayOrders(laundromatId, today),
    getTodayRevenue(laundromatId, today)
  ]);

  const todayOrders = todayOrdersResult;
  const revenueToday = revenueResult;

  // Process orders by status
  const ordersByStatus = categorizeOrdersByStatus(todayOrders);
  
  // Calculate today's statistics
  const todayStats = calculateTodayStats(todayOrders);

  return {
    laundromat,
    todayOrders,
    ordersByStatus,
    todayStats,
    revenueToday
  };
}

/**
 * Get today's orders for a laundromat
 */
async function getTodayOrders(laundromatId: string, today: string): Promise<OrderWithCustomer[]> {
  const serviceClient = getServiceClient();

  const { data: orders } = await serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        full_name,
        email,
        phone
      ),
      address:addresses (
        line1,
        city,
        state,
        postal_code
      )
    `)
    .eq('assigned_laundromat_id', laundromatId)
    .or(`pickup_date.eq.${today},delivery_date.eq.${today}`)
    .order('pickup_date', { ascending: true });

  return orders || [];
}

/**
 * Get today's revenue for a laundromat
 */
async function getTodayRevenue(laundromatId: string, today: string): Promise<number> {
  const serviceClient = getServiceClient();

  // This would typically come from a payments/billing table
  // For now, estimate based on completed orders and weight
  const { data: completedOrders } = await serviceClient
    .from('orders')
    .select('measured_weight_lb')
    .eq('assigned_laundromat_id', laundromatId)
    .eq('status', 'completed')
    .gte('delivered_at', `${today}T00:00:00`)
    .lte('delivered_at', `${today}T23:59:59`);

  if (!completedOrders) return 0;

  // Estimate revenue: $2.49/lb for regular customers, $1.99/lb for members
  // For simplicity, using average of $2.24/lb
  const totalWeight = completedOrders.reduce((sum, order) => 
    sum + (order.measured_weight_lb || 0), 0
  );

  return totalWeight * 2.24;
}

/**
 * Categorize orders by their current status and urgency
 */
function categorizeOrdersByStatus(orders: OrderWithCustomer[]): OrdersByStatus {
  const pickup: OrderWithCustomer[] = [];
  const processing: OrderWithCustomer[] = [];
  const readyForDelivery: OrderWithCustomer[] = [];
  const outForDelivery: OrderWithCustomer[] = [];

  let onTrack = 0;
  let atRisk = 0;
  let late = 0;

  const now = new Date();

  for (const order of orders) {
    // Categorize by status
    switch (order.status) {
      case 'scheduled':
      case 'en_route_pickup':
        pickup.push(order);
        break;
      case 'picked_up':
      case 'en_route_laundromat':
      case 'processing':
        processing.push(order);
        break;
      case 'ready_for_delivery':
        readyForDelivery.push(order);
        break;
      case 'en_route_delivery':
        outForDelivery.push(order);
        break;
    }

    // Determine urgency based on timing
    const pickupDate = order.pickup_date ? new Date(order.pickup_date) : null;
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date) : null;
    
    if (order.status === 'scheduled' || order.status === 'en_route_pickup') {
      // Check if pickup is overdue
      if (pickupDate && pickupDate < now) {
        late++;
      } else if (pickupDate && (pickupDate.getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
        // Within 2 hours
        atRisk++;
      } else {
        onTrack++;
      }
    } else if (order.status === 'processing') {
      // Check processing time against turnaround promise
      const pickedUpAt = order.picked_up_at ? new Date(order.picked_up_at) : null;
      if (pickedUpAt) {
        const hoursInProcess = (now.getTime() - pickedUpAt.getTime()) / (1000 * 60 * 60);
        if (hoursInProcess > 24) {
          late++;
        } else if (hoursInProcess > 18) {
          atRisk++;
        } else {
          onTrack++;
        }
      } else {
        onTrack++;
      }
    } else if (order.status === 'ready_for_delivery') {
      // Check if delivery is due
      if (deliveryDate && deliveryDate < now) {
        late++;
      } else if (deliveryDate && (deliveryDate.getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
        atRisk++;
      } else {
        onTrack++;
      }
    } else {
      onTrack++;
    }
  }

  return {
    pickupQueue: pickup,
    processing,
    readyForDelivery,
    outForDelivery,
    onTrack,
    atRisk,
    late
  };
}

/**
 * Calculate statistics for today's orders
 */
function calculateTodayStats(orders: OrderWithCustomer[]): TodayStats {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => 
    o.status === 'delivered' || o.status === 'completed'
  ).length;

  const ordersWithWeight = orders.filter(o => o.measured_weight_lb);
  const totalWeight = ordersWithWeight.reduce((sum, order) => 
    sum + (order.measured_weight_lb || 0), 0
  );
  const averageWeight = ordersWithWeight.length > 0 ? totalWeight / ordersWithWeight.length : 0;

  return {
    totalOrders,
    completedOrders,
    totalWeight,
    averageWeight: Math.round(averageWeight * 100) / 100
  };
}

/**
 * Get orders that need immediate attention
 */
export async function getUrgentOrders(laundromatId: string): Promise<OrderWithCustomer[]> {
  const serviceClient = getServiceClient();
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const { data: urgentOrders } = await serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        full_name,
        email,
        phone
      )
    `)
    .eq('assigned_laundromat_id', laundromatId)
    .or(
      `and(status.eq.scheduled,pickup_date.lte.${twoHoursFromNow.toISOString()}),` +
      `and(status.eq.processing,picked_up_at.lte.${new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString()}),` +
      `and(status.eq.ready_for_delivery,delivery_date.lte.${twoHoursFromNow.toISOString()})`
    )
    .order('pickup_date', { ascending: true });

  return urgentOrders || [];
}

/**
 * Get laundromat capacity status
 */
export async function getLaundromatCapacity(laundromatId: string): Promise<{
  current: number;
  maximum: number;
  percentage: number;
  status: 'low' | 'medium' | 'high' | 'full';
}> {
  const serviceClient = getServiceClient();

  const { data: laundromat } = await serviceClient
    .from('laundromats')
    .select('today_orders, max_daily_orders')
    .eq('id', laundromatId)
    .single();

  if (!laundromat) {
    return { current: 0, maximum: 0, percentage: 0, status: 'low' };
  }

  const current = laundromat.today_orders || 0;
  const maximum = laundromat.max_daily_orders || 0;
  const percentage = maximum > 0 ? (current / maximum) * 100 : 0;

  let status: 'low' | 'medium' | 'high' | 'full';
  if (percentage >= 100) status = 'full';
  else if (percentage >= 80) status = 'high';
  else if (percentage >= 60) status = 'medium';
  else status = 'low';

  return {
    current,
    maximum,
    percentage: Math.round(percentage),
    status
  };
}