-- Migration: Add driver workflow fields to orders table and create audit table
-- Generated manually for production-ready driver workflow system

-- Add workflow fields to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'scheduled' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickup_photo" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "laundry_photo" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_photo" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "picked_up_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ready_for_delivery_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- Create enum constraint for status field
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" 
CHECK ("status" IN (
  'scheduled',
  'picked_up',
  'processing', 
  'ready_for_delivery',
  'en_route_delivery',
  'delivered',
  'completed',
  'canceled'
));

-- Create order status history audit table
CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id"),
  "status" text NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for audit table queries
CREATE INDEX IF NOT EXISTS "idx_order_status_history_order_id" ON "order_status_history"("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_status_history_changed_at" ON "order_status_history"("changed_at");

-- Create trigger to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to orders table
DROP TRIGGER IF EXISTS orders_updated_at ON "orders";
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON "orders"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON COLUMN "orders"."status" IS 'Current status of the order in the driver workflow';
COMMENT ON COLUMN "orders"."pickup_photo" IS 'Photo URL from driver pickup confirmation';
COMMENT ON COLUMN "orders"."laundry_photo" IS 'Photo URL from laundromat processing completion';
COMMENT ON COLUMN "orders"."delivery_photo" IS 'Photo URL from driver delivery confirmation';
COMMENT ON TABLE "order_status_history" IS 'Audit trail for all order status changes';