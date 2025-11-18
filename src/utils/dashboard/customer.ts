/**
 * Customer Dashboard Data Layer
 *
 * All database queries for the customer dashboard.
 * Uses authenticated Supabase client passed in from pages.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get customer record by Supabase auth user ID
 */
export async function getCustomerId(
  authUserId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (error || !data) {
      console.error('[Dashboard] Error fetching customer:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[Dashboard] Exception in getCustomerId:', error);
    return null;
  }
}

/**
 * Get customer's active orders
 * Includes orders that are scheduled, picked up, or in progress
 */
export async function getActiveOrders(
  customerId: string,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        pickup_date,
        status,
        service_type,
        plan_type,
        measured_weight_lb,
        total_cents,
        subtotal_cents,
        pickup_address_line1,
        pickup_address_line2,
        pickup_address_city,
        pickup_address_state,
        pickup_address_postal_code,
        created_at,
        time_windows!pickup_time_window_id(label)
      `)
      .eq('customer_id', customerId)
      .eq('status', 'scheduled') // Currently only 'scheduled' exists in your schema
      .order('pickup_date', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[Dashboard] Error fetching active orders:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Dashboard] Exception in getActiveOrders:', error);
    return [];
  }
}

/**
 * Get customer's upcoming pickups (future scheduled orders)
 */
export async function getUpcomingPickups(
  customerId: string,
  supabase: SupabaseClient
) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        pickup_date,
        pickup_address_line1,
        pickup_address_line2,
        pickup_address_city,
        pickup_address_state,
        pickup_address_postal_code,
        notes,
        service_type,
        time_windows!pickup_time_window_id(label)
      `)
      .eq('customer_id', customerId)
      .eq('status', 'scheduled')
      .gte('pickup_date', today)
      .order('pickup_date', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[Dashboard] Error fetching upcoming pickups:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Dashboard] Exception in getUpcomingPickups:', error);
    return [];
  }
}

/**
 * Get customer's order history (completed orders)
 * NOTE: Currently only 'scheduled' status exists in schema
 * This will return empty until you implement completion flow
 */
export async function getOrderHistory(
  customerId: string,
  supabase: SupabaseClient,
  limit = 10
) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        pickup_date,
        delivery_date,
        status,
        service_type,
        plan_type,
        measured_weight_lb,
        total_cents,
        subtotal_cents,
        created_at,
        updated_at,
        time_windows!pickup_time_window_id(label)
      `)
      .eq('customer_id', customerId)
      // Future: Add other completion statuses here when implemented
      // .in('status', ['completed', 'delivered', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Dashboard] Error fetching order history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Dashboard] Exception in getOrderHistory:', error);
    return [];
  }
}

/**
 * Get customer statistics
 * NOTE: Will be empty until orders are completed
 */
export async function getOrderStats(
  customerId: string,
  supabase: SupabaseClient
) {
  try {
    // Get all orders for stats (adjust when completion statuses are added)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_cents, measured_weight_lb, created_at')
      .eq('customer_id', customerId);

    if (error) {
      console.error('[Dashboard] Error fetching order stats:', error);
      return {
        totalOrders: 0,
        totalSpent: 0,
        totalWeight: 0,
        ordersThisMonth: 0,
        averageOrderValue: 0,
      };
    }

    const allOrders = orders || [];
    const totalOrders = allOrders.length;
    const totalSpent = allOrders.reduce(
      (sum, order) => sum + (order.total_cents || 0),
      0
    );
    const totalWeight = allOrders.reduce(
      (sum, order) => sum + (order.measured_weight_lb || 0),
      0
    );

    // Count orders this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ordersThisMonth = allOrders.filter(
      (order) => new Date(order.created_at) >= firstDayOfMonth
    ).length;

    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    return {
      totalOrders,
      totalSpent,
      totalWeight,
      ordersThisMonth,
      averageOrderValue: avgOrderValue,
    };
  } catch (error) {
    console.error('[Dashboard] Exception in getOrderStats:', error);
    return {
      totalOrders: 0,
      totalSpent: 0,
      totalWeight: 0,
      ordersThisMonth: 0,
      averageOrderValue: 0,
    };
  }
}

/**
 * Get customer's active membership
 * Reuses logic from existing membership.ts
 */
export async function getMembershipInfo(
  customerId: string,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('id, status, start_date, end_date, membership_type')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Dashboard] Error fetching membership:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Calculate days remaining
    const endDate = new Date(data.end_date);
    const today = new Date();
    const daysRemaining = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ...data,
      daysRemaining: Math.max(0, daysRemaining),
    };
  } catch (error) {
    console.error('[Dashboard] Exception in getMembershipInfo:', error);
    return null;
  }
}

/**
 * Get customer's saved addresses
 */
export async function getCustomerAddresses(
  customerId: string,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Dashboard] Error fetching addresses:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Dashboard] Exception in getCustomerAddresses:', error);
    return [];
  }
}

/**
 * Get a single order by ID (for order detail page)
 */
export async function getOrderById(
  orderId: string,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_time_window:time_windows!pickup_time_window_id(*),
        delivery_time_window:time_windows!delivery_time_window_id(*)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('[Dashboard] Error fetching order:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Dashboard] Exception in getOrderById:', error);
    return null;
  }
}

/**
 * Master function: Fetch all dashboard data in parallel
 * Use this in dashboard.astro for optimal performance
 */
export async function getDashboardData(
  authUserId: string,
  supabase: SupabaseClient
) {
  try {
    // 1. Get customer ID first
    const customerId = await getCustomerId(authUserId, supabase);

    if (!customerId) {
      console.warn('[Dashboard] Customer not found for auth user');
      return null;
    }

    // 2. Fetch all data in parallel
    const [
      activeOrders,
      upcomingPickups,
      orderHistory,
      stats,
      membership,
      addresses,
    ] = await Promise.all([
      getActiveOrders(customerId, supabase),
      getUpcomingPickups(customerId, supabase),
      getOrderHistory(customerId, supabase),
      getOrderStats(customerId, supabase),
      getMembershipInfo(customerId, supabase),
      getCustomerAddresses(customerId, supabase),
    ]);

    return {
      customerId,
      activeOrders,
      upcomingPickups,
      orderHistory,
      stats,
      membership,
      addresses,
    };
  } catch (error) {
    console.error('[Dashboard] Exception in getDashboardData:', error);
    return null;
  }
}
