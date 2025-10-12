// src/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  boolean,
  date,
  timestamp,
  numeric,
  doublePrecision,
} from "drizzle-orm/pg-core";

// ------------------------------------------------------------------
// ADDRESSES
// ------------------------------------------------------------------
export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull(),
  label: text("label"),
  line1: text("line1"),
  line2: text("line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// ADMINS
// ------------------------------------------------------------------
export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: uuid("auth_user_id").notNull(),
  fullName: text("full_name"),
  email: text("email").unique(),
  permissions: jsonb("permissions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// CUSTOMERS
// ------------------------------------------------------------------
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: uuid("auth_user_id"),
  fullName: text("full_name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
});

// ------------------------------------------------------------------
// DAILY CAPACITY
// ------------------------------------------------------------------
export const dailyCapacity = pgTable("daily_capacity", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceDate: date("service_date"),
  zoneId: uuid("zone_id"),
  timeWindowId: uuid("time_window_id"),
  pickupCapacity: integer("pickup_capacity"),
  deliveryCapacity: integer("delivery_capacity"),
});

// ------------------------------------------------------------------
// DRIVER ASSIGNMENTS
// ------------------------------------------------------------------
export const driverAssignments = pgTable("driver_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id"),
  serviceDate: date("service_date"),
  zoneId: uuid("zone_id"),
  timeWindowId: uuid("time_window_id"),
});

// ------------------------------------------------------------------
// DRIVERS
// ------------------------------------------------------------------
export const drivers = pgTable("drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  active: boolean("active").default(true),
  authUserId: uuid("auth_user_id"),
});

// ------------------------------------------------------------------
// MEMBERSHIPS
// ------------------------------------------------------------------
export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("active"),
  membershipType: text("membership_type"), // e.g. bag, per-pound, premium
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id"),
  channel: text("channel"), // e.g. SMS, email, push
  event: text("event"), // e.g. order_status_update
  payload: jsonb("payload"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

// ------------------------------------------------------------------
// ORDERS
// ------------------------------------------------------------------
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull(),
  addressId: uuid("address_id"),
  serviceType: text("service_type"), // e.g. wash_and_fold
  planType: text("plan_type"), // e.g. member, non-member
  notes: text("notes"),
  preferences: jsonb("preferences"),
  pickupDate: date("pickup_date"),
  pickupTimeWindowId: uuid("pickup_time_window_id"),
  zoneId: uuid("zone_id"),
  pickupConfirmedAt: timestamp("pickup_confirmed_at", { withTimezone: true }),
  deliveryDate: date("delivery_date"),
  deliveryTimeWindowId: uuid("delivery_time_window_id"),
  measuredWeightLb: numeric("measured_weight_lb", { precision: 10, scale: 2 }),

  // === Driver Workflow ===
  status: text("status", {
    enum: [
      "scheduled",
      "picked_up",
      "processing",
      "ready_for_delivery",
      "en_route_delivery",
      "delivered",
      "completed",
      "canceled",
    ],
  }).notNull().default("scheduled"),

  pickupPhoto: text("pickup_photo"),
  laundryPhoto: text("laundry_photo"),
  deliveryPhoto: text("delivery_photo"),

  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  readyForDeliveryAt: timestamp("ready_for_delivery_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// ORDER STATUS HISTORY (Audit Trail)
// ------------------------------------------------------------------
export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  status: text("status").notNull(),
  changedBy: uuid("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// SERVICE ZONES
// ------------------------------------------------------------------
export const serviceZones = pgTable("service_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  description: text("description"),
});

// ------------------------------------------------------------------
// TASKS
// ------------------------------------------------------------------
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title"),
  description: text("description"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ------------------------------------------------------------------
// TIME WINDOWS
// ------------------------------------------------------------------
export const timeWindows = pgTable("time_windows", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label"), // e.g. "8AM–10AM"
  startTime: text("start_time"),
  endTime: text("end_time"),
});

// ------------------------------------------------------------------
// USERS
// ------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: uuid("auth_user_id"),
  role: text("role").default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
