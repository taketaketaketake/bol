/**
 * Laundromat Order Management Data Layer
 * 
 * Provides detailed order information for laundromat staff
 */

import type { Order, Laundromat, Customer, Address } from '../../db/schema';
import { getServiceClient } from '../order-status';

interface OrderStatusHistoryEntry {
  id: string;
  status: string;
  changed_at: string;
  changed_by?: string;
}

interface LaundromatOrderDetails {
  order: Order | null;
  customer: Customer | null;
  address: Address | null;
  laundromat: Laundromat | null;
  statusHistory: OrderStatusHistoryEntry[];
}

/**
 * Get comprehensive order details for laundromat staff
 */
export async function getLaundromatOrderDetails(
  orderId: string, 
  authUserId: string
): Promise<LaundromatOrderDetails> {
  const serviceClient = getServiceClient();

  // First, find the laundromat associated with this user
  const { data: staffRecord } = await serviceClient
    .from('laundromat_staff')
    .select(`
      laundromat_id,
      laundromats (
        id,
        name,
        address,
        city,
        state,
        phone,
        contact_email
      )
    `)
    .eq('auth_user_id', authUserId)
    .single();

  if (!staffRecord?.laundromats) {
    return {
      order: null,
      customer: null,
      address: null,
      laundromat: null,
      statusHistory: []
    };
  }

  const laundromat = staffRecord.laundromats;

  // Get the order with customer and address information
  const { data: orderData } = await serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        id,
        full_name,
        email,
        phone,
        sms_opt_in
      ),
      address:addresses (
        id,
        line1,
        line2,
        city,
        state,
        postal_code
      )
    `)
    .eq('id', orderId)
    .eq('assigned_laundromat_id', laundromat.id)
    .single();

  if (!orderData) {
    return {
      order: null,
      customer: null,
      address: null,
      laundromat,
      statusHistory: []
    };
  }

  // Get status history
  const { data: statusHistory } = await serviceClient
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false });

  return {
    order: orderData,
    customer: orderData.customer,
    address: orderData.address,
    laundromat,
    statusHistory: statusHistory || []
  };
}

/**
 * Get all orders for a laundromat with filtering options
 */
export async function getLaundromatOrders(
  authUserId: string,
  options: {
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  orders: Array<Order & { customer?: Customer; address?: Address }>;
  totalCount: number;
  laundromat: Laundromat | null;
}> {
  const serviceClient = getServiceClient();

  // First, find the laundromat associated with this user
  const { data: staffRecord } = await serviceClient
    .from('laundromat_staff')
    .select(`
      laundromat_id,
      laundromats (
        id,
        name
      )
    `)
    .eq('auth_user_id', authUserId)
    .single();

  if (!staffRecord?.laundromats) {
    return {
      orders: [],
      totalCount: 0,
      laundromat: null
    };
  }

  const laundromat = staffRecord.laundromats;

  // Build query
  let query = serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        id,
        full_name,
        email,
        phone
      ),
      address:addresses (
        id,
        line1,
        city,
        state,
        postal_code
      )
    `, { count: 'exact' })
    .eq('assigned_laundromat_id', laundromat.id);

  // Apply filters
  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.startDate) {
    query = query.gte('pickup_date', options.startDate);
  }

  if (options.endDate) {
    query = query.lte('pickup_date', options.endDate);
  }

  // Apply pagination
  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 25) - 1);
  }

  // Order by pickup date (newest first)
  query = query.order('pickup_date', { ascending: false });

  const { data: orders, count } = await query;

  return {
    orders: orders || [],
    totalCount: count || 0,
    laundromat
  };
}

/**
 * Get orders that need immediate attention
 */
export async function getUrgentLaundromatOrders(authUserId: string): Promise<{
  urgentOrders: Array<Order & { customer?: Customer; urgencyReason: string }>;
  laundromat: Laundromat | null;
}> {
  const serviceClient = getServiceClient();

  // First, find the laundromat associated with this user
  const { data: staffRecord } = await serviceClient
    .from('laundromat_staff')
    .select(`
      laundromat_id,
      laundromats (
        id,
        name
      )
    `)
    .eq('auth_user_id', authUserId)
    .single();

  if (!staffRecord?.laundromats) {
    return {
      urgentOrders: [],
      laundromat: null
    };
  }

  const laundromat = staffRecord.laundromats;

  // Get orders that might need attention
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: orders } = await serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        id,
        full_name,
        email,
        phone
      )
    `)
    .eq('assigned_laundromat_id', laundromat.id)
    .in('status', ['scheduled', 'en_route_pickup', 'picked_up', 'processing', 'ready_for_delivery'])
    .order('pickup_date', { ascending: true });

  const urgentOrders = (orders || []).map(order => {
    let urgencyReason = '';
    const pickupDate = order.pickup_date ? new Date(order.pickup_date) : null;
    const pickedUpAt = order.picked_up_at ? new Date(order.picked_up_at) : null;

    if (order.status === 'scheduled' && pickupDate && pickupDate < now) {
      urgencyReason = 'Pickup overdue';
    } else if (order.status === 'en_route_pickup' && pickupDate && pickupDate < twoHoursAgo) {
      urgencyReason = 'Pickup route taking too long';
    } else if (order.status === 'processing' && pickedUpAt && pickedUpAt < oneDayAgo) {
      urgencyReason = 'Processing taking too long';
    } else if (order.status === 'ready_for_delivery' && order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date);
      if (deliveryDate < now) {
        urgencyReason = 'Delivery overdue';
      } else if ((deliveryDate.getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
        urgencyReason = 'Delivery due soon';
      }
    }

    return {
      ...order,
      urgencyReason
    };
  }).filter(order => order.urgencyReason);

  return {
    urgentOrders,
    laundromat
  };
}

/**
 * Get laundromat performance metrics
 */
export async function getLaundromatPerformanceMetrics(authUserId: string): Promise<{
  metrics: {
    averagePickupTime: number; // in hours
    averageProcessingTime: number; // in hours
    averageDeliveryTime: number; // in hours
    onTimePerformance: number; // percentage
    customerSatisfaction: number; // average rating
    totalOrdersThisMonth: number;
    completedOrdersThisMonth: number;
  } | null;
  laundromat: Laundromat | null;
}> {
  const serviceClient = getServiceClient();

  // First, find the laundromat associated with this user
  const { data: staffRecord } = await serviceClient
    .from('laundromat_staff')
    .select(`
      laundromat_id,
      laundromats (
        id,
        name
      )
    `)
    .eq('auth_user_id', authUserId)
    .single();

  if (!staffRecord?.laundromats) {
    return {
      metrics: null,
      laundromat: null
    };
  }

  const laundromat = staffRecord.laundromats;

  // Get this month's orders for performance calculation
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthOrders } = await serviceClient
    .from('orders')
    .select('*')
    .eq('assigned_laundromat_id', laundromat.id)
    .gte('pickup_date', startOfMonth.toISOString())
    .in('status', ['delivered', 'completed']);

  if (!monthOrders || monthOrders.length === 0) {
    return {
      metrics: {
        averagePickupTime: 0,
        averageProcessingTime: 0,
        averageDeliveryTime: 0,
        onTimePerformance: 0,
        customerSatisfaction: 0,
        totalOrdersThisMonth: 0,
        completedOrdersThisMonth: 0
      },
      laundromat
    };
  }

  // Calculate performance metrics
  let totalPickupTime = 0;
  let totalProcessingTime = 0;
  let totalDeliveryTime = 0;
  let onTimeCount = 0;
  let validPickupTimes = 0;
  let validProcessingTimes = 0;
  let validDeliveryTimes = 0;

  for (const order of monthOrders) {
    const pickupDate = order.pickup_date ? new Date(order.pickup_date) : null;
    const pickedUpAt = order.picked_up_at ? new Date(order.picked_up_at) : null;
    const readyAt = order.ready_for_delivery_at ? new Date(order.ready_for_delivery_at) : null;
    const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;

    // Calculate pickup time
    if (pickupDate && pickedUpAt && pickedUpAt >= pickupDate) {
      totalPickupTime += (pickedUpAt.getTime() - pickupDate.getTime()) / (1000 * 60 * 60);
      validPickupTimes++;
    }

    // Calculate processing time
    if (pickedUpAt && readyAt && readyAt >= pickedUpAt) {
      totalProcessingTime += (readyAt.getTime() - pickedUpAt.getTime()) / (1000 * 60 * 60);
      validProcessingTimes++;
    }

    // Calculate delivery time
    if (readyAt && deliveredAt && deliveredAt >= readyAt) {
      totalDeliveryTime += (deliveredAt.getTime() - readyAt.getTime()) / (1000 * 60 * 60);
      validDeliveryTimes++;
    }

    // Check if order was on time (delivered by promised delivery date)
    if (deliveredAt && order.delivery_date) {
      const promisedDelivery = new Date(order.delivery_date);
      if (deliveredAt <= promisedDelivery) {
        onTimeCount++;
      }
    }
  }

  // Get total orders this month (including incomplete ones)
  const { count: totalThisMonth } = await serviceClient
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_laundromat_id', laundromat.id)
    .gte('pickup_date', startOfMonth.toISOString());

  const metrics = {
    averagePickupTime: validPickupTimes > 0 ? totalPickupTime / validPickupTimes : 0,
    averageProcessingTime: validProcessingTimes > 0 ? totalProcessingTime / validProcessingTimes : 0,
    averageDeliveryTime: validDeliveryTimes > 0 ? totalDeliveryTime / validDeliveryTimes : 0,
    onTimePerformance: monthOrders.length > 0 ? (onTimeCount / monthOrders.length) * 100 : 0,
    customerSatisfaction: 4.5, // TODO: Implement actual rating system
    totalOrdersThisMonth: totalThisMonth || 0,
    completedOrdersThisMonth: monthOrders.length
  };

  return {
    metrics,
    laundromat
  };
}