// src/db/schema.ts
// TypeScript type definitions for database tables
// Used with Supabase (no Drizzle dependencies)

// ------------------------------------------------------------------
// ORDER STATUS TYPES
// ------------------------------------------------------------------
export const ORDER_STATUSES = [
  'scheduled',
  'picked_up', 
  'processing',
  'ready_for_delivery',
  'en_route_delivery',
  'delivered',
  'completed',
  'canceled'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

// ------------------------------------------------------------------
// DATABASE TABLE TYPES
// ------------------------------------------------------------------

export interface Address {
  id: string;
  customer_id: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
  created_at?: string;
}

export interface Admin {
  id: string;
  auth_user_id: string;
  full_name?: string;
  email?: string;
  permissions?: any;
  created_at?: string;
}

export interface Customer {
  id: string;
  auth_user_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at?: string;
  stripe_customer_id?: string;
}

export interface DailyCapacity {
  id: string;
  service_date?: string;
  zone_id?: string;
  time_window_id?: string;
  pickup_capacity?: number;
  delivery_capacity?: number;
}

export interface DriverAssignment {
  id: string;
  driver_id?: string;
  service_date?: string;
  zone_id?: string;
  time_window_id?: string;
}

export interface Driver {
  id: string;
  full_name: string;
  phone?: string;
  active?: boolean;
  auth_user_id?: string;
}

export interface Membership {
  id: string;
  customer_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status?: string;
  membership_type?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  order_id?: string;
  channel?: string;
  event?: string;
  payload?: any;
  sent_at?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  address_id?: string;
  service_type?: string;
  plan_type?: string;
  notes?: string;
  preferences?: any;
  pickup_date?: string;
  pickup_time_window_id?: string;
  zone_id?: string;
  pickup_confirmed_at?: string;
  delivery_date?: string;
  delivery_time_window_id?: string;
  measured_weight_lb?: number;
  
  // Driver Workflow Fields
  status: OrderStatus;
  pickup_photo?: string;
  laundry_photo?: string;
  delivery_photo?: string;
  picked_up_at?: string;
  ready_for_delivery_at?: string;
  delivered_at?: string;
  updated_at?: string;
  
  // Driver tracking
  driver_id?: string;
  delivery_notes?: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  changed_by?: string;
  changed_at?: string;
}

export interface ServiceZone {
  id: string;
  name?: string;
  description?: string;
}

export interface TimeWindow {
  id: string;
  label?: string;
  start_time?: string;
  end_time?: string;
}

export interface User {
  id: string;
  auth_user_id?: string;
  role?: string;
  created_at?: string;
}