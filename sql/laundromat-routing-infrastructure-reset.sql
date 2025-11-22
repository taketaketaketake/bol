-- ===================================================
-- LAUNDROMAT ROUTING INFRASTRUCTURE RESET MIGRATION
-- Complete replacement of zone-based with laundromat-centric routing
-- ===================================================

-- ===================================================
-- PHASE 1: DROP OLD INFRASTRUCTURE
-- ===================================================

-- Drop dependent functions first
DROP FUNCTION IF EXISTS get_available_windows(text, date, uuid);

-- Drop old tables that will be replaced
DROP TABLE IF EXISTS daily_capacity CASCADE;
DROP TABLE IF EXISTS driver_assignments CASCADE; 
DROP TABLE IF EXISTS service_zones CASCADE;

-- Drop views that depend on old tables
DROP VIEW IF EXISTS window_load CASCADE;

-- ===================================================
-- PHASE 2: UPDATE EXISTING LAUNDROMATS TABLE
-- ===================================================

-- The laundromats table exists but needs enhancement for routing
ALTER TABLE laundromats 
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS radius_miles integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_daily_orders integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS today_orders integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_connect_id text,
ADD COLUMN IF NOT EXISTS operates_morning boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS operates_afternoon boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS operates_evening boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS avg_turnaround_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS notification_phone text;

-- Update existing columns to match new schema
UPDATE laundromats SET 
  zip_code = postal_code WHERE zip_code IS NULL;

-- ===================================================
-- PHASE 3: CREATE NEW ROUTING INFRASTRUCTURE
-- ===================================================

-- Laundromat Service Areas (many-to-many ZIP coverage)
CREATE TABLE laundromat_service_areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  laundromat_id uuid NOT NULL REFERENCES laundromats(id) ON DELETE CASCADE,
  zip_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(laundromat_id, zip_code)
);

-- Create indexes for fast routing lookups
CREATE INDEX idx_laundromat_service_areas_zip ON laundromat_service_areas(zip_code);
CREATE INDEX idx_laundromat_service_areas_laundromat ON laundromat_service_areas(laundromat_id);

-- ===================================================
-- PHASE 4: UPDATE ORDERS TABLE
-- ===================================================

-- Add new routing fields to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assigned_laundromat_id uuid REFERENCES laundromats(id),
ADD COLUMN IF NOT EXISTS routing_method text DEFAULT 'zip_match',
ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Remove old zone-based field
ALTER TABLE orders DROP COLUMN IF EXISTS zone_id;

-- ===================================================
-- PHASE 5: ROUTING FUNCTIONS
-- ===================================================

-- Core function: Find available laundromats by ZIP code
CREATE OR REPLACE FUNCTION find_laundromat_by_zip(incoming_zip text)
RETURNS TABLE (
  id uuid,
  name text,
  today_orders integer,
  max_daily_orders integer,
  capacity_remaining integer,
  stripe_connect_id text,
  contact_email text,
  avg_turnaround_hours integer
)
LANGUAGE sql
AS $$
  SELECT 
    l.id,
    l.name,
    l.today_orders,
    l.max_daily_orders,
    (l.max_daily_orders - l.today_orders) as capacity_remaining,
    l.stripe_connect_id,
    l.contact_email,
    l.avg_turnaround_hours
  FROM laundromat_service_areas lsa
  JOIN laundromats l ON lsa.laundromat_id = l.id
  WHERE lsa.zip_code = incoming_zip
    AND l.is_active = true
    AND l.today_orders < l.max_daily_orders
  ORDER BY l.today_orders ASC, l.name ASC;
$$;

-- Function: Assign order to laundromat
CREATE OR REPLACE FUNCTION assign_order_to_laundromat(order_id uuid, laundromat_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update order assignment
  UPDATE orders 
  SET 
    assigned_laundromat_id = laundromat_id,
    assigned_at = now(),
    routing_method = 'zip_match'
  WHERE id = order_id;
  
  -- Increment laundromat daily counter
  UPDATE laundromats 
  SET today_orders = today_orders + 1
  WHERE id = laundromat_id;
  
  -- Return success
  RETURN FOUND;
END;
$$;

-- Function: Get laundromat capacity status
CREATE OR REPLACE FUNCTION get_laundromat_capacity(laundromat_id uuid)
RETURNS TABLE (
  name text,
  today_orders integer,
  max_daily_orders integer,
  capacity_remaining integer,
  utilization_percent numeric
)
LANGUAGE sql
AS $$
  SELECT 
    l.name,
    l.today_orders,
    l.max_daily_orders,
    (l.max_daily_orders - l.today_orders) as capacity_remaining,
    ROUND((l.today_orders::numeric / l.max_daily_orders::numeric) * 100, 1) as utilization_percent
  FROM laundromats l
  WHERE l.id = laundromat_id;
$$;

-- Function: Reset daily counters (run via cron daily)
CREATE OR REPLACE FUNCTION reset_daily_laundromat_counters()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE laundromats SET today_orders = 0 WHERE today_orders > 0;
$$;

-- ===================================================
-- PHASE 6: SAMPLE DATA SETUP
-- ===================================================

-- Insert sample Detroit laundromats
INSERT INTO laundromats (name, address, city, state, zip_code, phone, max_daily_orders, is_active) VALUES
('Midtown Wash & Fold', '4801 Cass Ave', 'Detroit', 'MI', '48201', '(313) 555-0101', 40, true),
('Westside Laundry Hub', '8200 W Vernor Hwy', 'Detroit', 'MI', '48209', '(313) 555-0102', 35, true),
('Downtown Express Wash', '1234 Griswold St', 'Detroit', 'MI', '48226', '(313) 555-0103', 50, true),
('Hamtramck Clean Center', '11800 Jos Campau Ave', 'Hamtramck', 'MI', '48212', '(313) 555-0104', 30, true)
ON CONFLICT (id) DO NOTHING;

-- Set up service area coverage
INSERT INTO laundromat_service_areas (laundromat_id, zip_code) 
SELECT l.id, unnest(ARRAY[
  CASE l.name 
    WHEN 'Midtown Wash & Fold' THEN ARRAY['48201', '48202', '48226']
    WHEN 'Westside Laundry Hub' THEN ARRAY['48209', '48210', '48228']
    WHEN 'Downtown Express Wash' THEN ARRAY['48226', '48201', '48243']
    WHEN 'Hamtramck Clean Center' THEN ARRAY['48212', '48213']
    ELSE ARRAY[]::text[]
  END
]) as zip_code
FROM laundromats l 
WHERE l.name IN ('Midtown Wash & Fold', 'Westside Laundry Hub', 'Downtown Express Wash', 'Hamtramck Clean Center')
ON CONFLICT (laundromat_id, zip_code) DO NOTHING;

-- ===================================================
-- PHASE 7: UPDATE SCHEMA TYPES
-- ===================================================

-- Update the order status tracking to include routing events
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
SELECT id, 'scheduled', null, created_at 
FROM orders 
WHERE assigned_laundromat_id IS NULL
ON CONFLICT DO NOTHING;

-- ===================================================
-- VERIFICATION QUERIES
-- ===================================================

-- Verify laundromat setup
-- SELECT name, zip_code, max_daily_orders, today_orders FROM laundromats WHERE is_active = true;

-- Verify service area coverage
-- SELECT l.name, string_agg(lsa.zip_code, ', ') as covered_zips 
-- FROM laundromats l 
-- JOIN laundromat_service_areas lsa ON l.id = lsa.laundromat_id 
-- GROUP BY l.name;

-- Test routing function
-- SELECT * FROM find_laundromat_by_zip('48201');

-- ===================================================
-- MIGRATION COMPLETE
-- ===================================================

-- Create a migration log entry
CREATE TABLE IF NOT EXISTS migration_log (
  id serial PRIMARY KEY,
  migration_name text NOT NULL,
  executed_at timestamptz DEFAULT now(),
  description text
);

INSERT INTO migration_log (migration_name, description) VALUES 
('laundromat-routing-infrastructure-reset', 
 'Complete replacement of zone-based routing with laundromat-centric infrastructure. Dropped service_zones, daily_capacity, driver_assignments. Created laundromat_service_areas and routing functions.');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON laundromats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON laundromat_service_areas TO service_role;
GRANT EXECUTE ON FUNCTION find_laundromat_by_zip(text) TO service_role;
GRANT EXECUTE ON FUNCTION assign_order_to_laundromat(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_laundromat_capacity(uuid) TO service_role;