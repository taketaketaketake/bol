-- Setup Test Users for Integration Testing
-- Run this SQL in your Supabase SQL Editor or database console

-- First, create the auth users in Supabase Auth (you'll need to do this manually in Supabase dashboard)
-- OR use these existing user IDs if they already exist

-- Generate UUIDs for test users (you can run this to get new UUIDs)
-- SELECT gen_random_uuid() as customer_uuid, gen_random_uuid() as driver_uuid, gen_random_uuid() as admin_uuid;

-- Example UUIDs (replace with actual auth user IDs from your Supabase Auth users)
-- Customer: Replace with actual UUID from auth.users table
-- Driver: Replace with actual UUID from auth.users table  
-- Admin: Replace with actual UUID from auth.users table

-- STEP 1: Find existing auth user IDs
-- SELECT id, email FROM auth.users WHERE email IN ('customer@test.com', 'driver@test.com', 'admin@test.com');

-- STEP 2: Insert into application tables (replace UUIDs with real ones)

-- Customer record
INSERT INTO customers (auth_user_id, full_name, email, phone, sms_opt_in) 
VALUES (
  'REPLACE_WITH_CUSTOMER_AUTH_UUID', 
  'Test Customer', 
  'customer@test.com',
  '+15551234567',
  true
) ON CONFLICT (auth_user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  sms_opt_in = EXCLUDED.sms_opt_in;

-- Driver record  
INSERT INTO drivers (auth_user_id, full_name, phone, active) 
VALUES (
  'REPLACE_WITH_DRIVER_AUTH_UUID',
  'Test Driver',
  '+15551234568', 
  true
) ON CONFLICT (auth_user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  active = EXCLUDED.active;

-- Admin record
INSERT INTO admins (auth_user_id, full_name, email, permissions) 
VALUES (
  'REPLACE_WITH_ADMIN_AUTH_UUID',
  'Test Admin',
  'admin@test.com',
  '{"all": true}'
) ON CONFLICT (auth_user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  permissions = EXCLUDED.permissions;

-- STEP 3: Verify user_roles view shows correct roles
-- SELECT ur.auth_user_id, ur.role, u.email 
-- FROM user_roles ur
-- JOIN auth.users u ON ur.auth_user_id = u.id
-- WHERE u.email IN ('customer@test.com', 'driver@test.com', 'admin@test.com');

-- STEP 4: Test laundromat data exists for routing
-- SELECT l.name, l.zip_code, l.max_daily_orders, l.today_orders, l.is_active
-- FROM laundromats l 
-- WHERE l.is_active = true;

-- STEP 5: Test service area coverage for test ZIP
-- SELECT l.name, lsa.zip_code 
-- FROM laundromat_service_areas lsa
-- JOIN laundromats l ON lsa.laundromat_id = l.id
-- WHERE lsa.zip_code = '48201';

-- If no laundromats exist, run this to create test data:
/*
INSERT INTO laundromats (name, address, city, state, zip_code, phone, max_daily_orders, is_active) VALUES
('Test Laundromat', '123 Test Ave', 'Detroit', 'MI', '48201', '(313) 555-0101', 40, true)
ON CONFLICT DO NOTHING;

INSERT INTO laundromat_service_areas (laundromat_id, zip_code) 
SELECT l.id, '48201' 
FROM laundromats l 
WHERE l.name = 'Test Laundromat'
ON CONFLICT (laundromat_id, zip_code) DO NOTHING;
*/