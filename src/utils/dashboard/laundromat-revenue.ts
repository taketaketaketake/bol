/**
 * Laundromat Revenue Dashboard Data Layer
 * 
 * Provides financial tracking and revenue data for laundromat partners
 */

import type { Order, Laundromat } from '../../db/schema';
import { getServiceClient } from '../order-status';
import { MEMBER_RATE, STANDARD_RATE } from '../pricing';

interface OrderWithRevenue extends Order {
  customer?: {
    full_name: string;
    email: string;
  };
  revenue: number;
}

interface DailyRevenue {
  total: number;
  orderCount: number;
  totalWeight: number;
  last7Days: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
}

interface WeeklyRevenue {
  total: number;
  orderCount: number;
  averagePerOrder: number;
}

interface MonthlyRevenue {
  total: number;
  orderCount: number;
  growthPercent: number;
  byServiceType: Array<{
    type: string;
    revenue: number;
    orders: number;
  }>;
}

interface PayoutSchedule {
  pendingAmount: number;
  nextPayoutDate: string;
  weekEnding: string;
  paymentMethod: string;
  frequency: string;
}

interface LaundromatRevenueData {
  laundromat: Laundromat | null;
  dailyRevenue: DailyRevenue;
  weeklyRevenue: WeeklyRevenue;
  monthlyRevenue: MonthlyRevenue;
  recentCompletedOrders: OrderWithRevenue[];
  payoutSchedule: PayoutSchedule;
}

/**
 * Get comprehensive revenue data for a laundromat
 */
export async function getLaundromatRevenueData(authUserId: string): Promise<LaundromatRevenueData> {
  const serviceClient = getServiceClient();

  // Get the staff member's assigned laundromat and check revenue permissions
  const { data: staffAssignment, error: staffError } = await serviceClient
    .from('laundromat_staff')
    .select(`
      laundromat_id,
      can_view_revenue,
      laundromat:laundromats (
        *
      )
    `)
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .single();

  console.log('Revenue staff assignment query result:', { staffAssignment, staffError });

  let laundromat, laundromatId;

  if (!staffAssignment || !staffAssignment.laundromat) {
    // Development fallback: Use first available laundromat
    console.warn('No staff assignment found for revenue, using development fallback');
    const { data: laundromats } = await serviceClient
      .from('laundromats')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (!laundromats || laundromats.length === 0) {
      return createEmptyRevenueData();
    }
    
    laundromat = laundromats[0];
    laundromatId = laundromat.id;
  } else if (!staffAssignment.can_view_revenue) {
    // Staff member doesn't have revenue viewing permission
    return createEmptyRevenueData();
  } else {
    laundromat = staffAssignment.laundromat;
    laundromatId = laundromat.id;
  }

  // Get date ranges
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfWeek = getStartOfWeek(today);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Parallel data fetching
  const [
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue,
    lastMonthRevenue,
    recentOrders,
    payoutInfo
  ] = await Promise.all([
    calculatePeriodRevenue(laundromatId, startOfDay, today),
    calculatePeriodRevenue(laundromatId, startOfWeek, today),
    calculatePeriodRevenue(laundromatId, startOfMonth, today),
    calculatePeriodRevenue(laundromatId, startOfLastMonth, endOfLastMonth),
    getRecentCompletedOrders(laundromatId),
    getPayoutSchedule(laundromatId)
  ]);

  // Calculate growth percentage
  const monthlyGrowth = lastMonthRevenue.total > 0 
    ? ((monthlyRevenue.total - lastMonthRevenue.total) / lastMonthRevenue.total) * 100
    : 0;

  // Get last 7 days breakdown
  const last7Days = await getLast7DaysBreakdown(laundromatId);

  // Get service type breakdown
  const serviceTypeBreakdown = await getServiceTypeBreakdown(laundromatId, startOfMonth, today);

  return {
    laundromat,
    dailyRevenue: {
      ...dailyRevenue,
      last7Days
    },
    weeklyRevenue: {
      ...weeklyRevenue,
      averagePerOrder: weeklyRevenue.orderCount > 0 ? weeklyRevenue.total / weeklyRevenue.orderCount : 0
    },
    monthlyRevenue: {
      ...monthlyRevenue,
      growthPercent: monthlyGrowth,
      byServiceType: serviceTypeBreakdown
    },
    recentCompletedOrders: recentOrders,
    payoutSchedule: payoutInfo
  };
}

/**
 * Calculate revenue for a specific time period
 */
async function calculatePeriodRevenue(
  laundromatId: string, 
  startDate: Date, 
  endDate: Date
): Promise<{ total: number; orderCount: number; totalWeight: number }> {
  const serviceClient = getServiceClient();

  const { data: orders } = await serviceClient
    .from('orders')
    .select('measured_weight_lb, service_type')
    .eq('assigned_laundromat_id', laundromatId)
    .eq('status', 'completed')
    .gte('delivered_at', startDate.toISOString())
    .lte('delivered_at', endDate.toISOString());

  if (!orders || orders.length === 0) {
    return { total: 0, orderCount: 0, totalWeight: 0 };
  }

  let totalRevenue = 0;
  let totalWeight = 0;

  for (const order of orders) {
    const weight = order.measured_weight_lb || 0;
    totalWeight += weight;
    
    // Calculate revenue based on service type and weight
    // Base pricing: $2.49/lb regular, $1.99/lb for membership customers
    const pricePerPound = getServicePrice(order.service_type);
    totalRevenue += weight * pricePerPound;
  }

  return {
    total: totalRevenue,
    orderCount: orders.length,
    totalWeight
  };
}

/**
 * Get recent completed orders with revenue calculations
 */
async function getRecentCompletedOrders(laundromatId: string): Promise<OrderWithRevenue[]> {
  const serviceClient = getServiceClient();

  const { data: orders } = await serviceClient
    .from('orders')
    .select(`
      *,
      customer:customers (
        full_name,
        email
      )
    `)
    .eq('assigned_laundromat_id', laundromatId)
    .eq('status', 'completed')
    .order('delivered_at', { ascending: false })
    .limit(10);

  if (!orders) return [];

  return orders.map(order => ({
    ...order,
    revenue: (order.measured_weight_lb || 0) * getServicePrice(order.service_type)
  }));
}

/**
 * Get last 7 days revenue breakdown
 */
async function getLast7DaysBreakdown(laundromatId: string): Promise<Array<{
  date: string;
  revenue: number;
  orders: number;
}>> {
  const serviceClient = getServiceClient();
  const results = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const dayData = await calculatePeriodRevenue(laundromatId, startOfDay, endOfDay);
    
    results.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      revenue: dayData.total,
      orders: dayData.orderCount
    });
  }

  return results;
}

/**
 * Get revenue breakdown by service type
 */
async function getServiceTypeBreakdown(
  laundromatId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ type: string; revenue: number; orders: number }>> {
  const serviceClient = getServiceClient();

  const { data: orders } = await serviceClient
    .from('orders')
    .select('service_type, measured_weight_lb')
    .eq('assigned_laundromat_id', laundromatId)
    .eq('status', 'completed')
    .gte('delivered_at', startDate.toISOString())
    .lte('delivered_at', endDate.toISOString());

  if (!orders) return [];

  const breakdown = orders.reduce((acc, order) => {
    const serviceType = order.service_type || 'standard';
    const weight = order.measured_weight_lb || 0;
    const revenue = weight * getServicePrice(serviceType);

    if (!acc[serviceType]) {
      acc[serviceType] = { revenue: 0, orders: 0 };
    }

    acc[serviceType].revenue += revenue;
    acc[serviceType].orders += 1;

    return acc;
  }, {} as Record<string, { revenue: number; orders: number }>);

  return Object.entries(breakdown).map(([type, data]) => ({
    type,
    ...data
  }));
}

/**
 * Get payout schedule information
 */
async function getPayoutSchedule(laundromatId: string): Promise<PayoutSchedule> {
  // This would typically come from Stripe Connect data
  // For now, providing mock data structure

  const today = new Date();
  const nextFriday = getNextFriday(today);
  const lastFriday = new Date(nextFriday);
  lastFriday.setDate(nextFriday.getDate() - 7);

  // Calculate pending amount (this week's completed orders)
  const startOfWeek = getStartOfWeek(today);
  const pendingData = await calculatePeriodRevenue(laundromatId, startOfWeek, today);

  return {
    pendingAmount: pendingData.total,
    nextPayoutDate: nextFriday.toLocaleDateString(),
    weekEnding: lastFriday.toLocaleDateString(),
    paymentMethod: 'Direct Deposit', // Would come from Stripe Connect
    frequency: 'Friday' // Weekly payouts
  };
}

/**
 * Get pricing per pound based on service type
 */
function getServicePrice(serviceType?: string): number {
  switch (serviceType) {
    case 'premium':
    case 'express':
      return 3.49;
    case 'delicate':
      return 2.99;
    case 'membership':
      return MEMBER_RATE; // $1.75/lb
    default:
      return STANDARD_RATE; // $2.25/lb
  }
}

/**
 * Get start of week (Monday)
 */
function getStartOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get next Friday
 */
function getNextFriday(date: Date): Date {
  const friday = new Date(date);
  const day = friday.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  
  if (daysUntilFriday === 0 && friday.getHours() >= 17) {
    // If it's Friday after 5 PM, get next Friday
    friday.setDate(friday.getDate() + 7);
  } else {
    friday.setDate(friday.getDate() + daysUntilFriday);
  }
  
  return friday;
}

/**
 * Create empty revenue data structure
 */
function createEmptyRevenueData(): LaundromatRevenueData {
  return {
    laundromat: null,
    dailyRevenue: {
      total: 0,
      orderCount: 0,
      totalWeight: 0,
      last7Days: []
    },
    weeklyRevenue: {
      total: 0,
      orderCount: 0,
      averagePerOrder: 0
    },
    monthlyRevenue: {
      total: 0,
      orderCount: 0,
      growthPercent: 0,
      byServiceType: []
    },
    recentCompletedOrders: [],
    payoutSchedule: {
      pendingAmount: 0,
      nextPayoutDate: 'N/A',
      weekEnding: 'N/A',
      paymentMethod: 'Not configured',
      frequency: 'Weekly'
    }
  };
}