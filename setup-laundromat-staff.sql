-- Setup script for adding laundromat staff members
-- Run this after creating the laundromat_staff table

-- Step 1: First, make sure you have laundromats in the system
-- Example laundromat (update with your actual data):
/*
INSERT INTO laundromats (id, name, address, city, state, zip_code, is_active, max_daily_orders)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Downtown Express Wash', '123 Main St', 'Detroit', 'MI', '48226', true, 50),
  ('550e8400-e29b-41d4-a716-446655440002', 'Midtown Wash & Fold', '456 Broadway', 'Detroit', 'MI', '48201', true, 30);
*/

-- Step 2: Create staff users in Supabase Auth (do this through Supabase dashboard or auth.users table)
-- You'll get back auth_user_id values to use below

-- Step 3: Add laundromat_staff role to user_roles table
-- Example (replace with actual auth_user_id values):
/*
INSERT INTO user_roles (auth_user_id, role) 
VALUES 
  ('auth-user-uuid-1', 'laundromat_staff'),
  ('auth-user-uuid-2', 'laundromat_staff'),
  ('auth-user-uuid-3', 'laundromat_staff');
*/

-- Step 4: Create laundromat staff records
-- Example staff assignments (replace with actual UUIDs):
/*
INSERT INTO laundromat_staff (
  auth_user_id, 
  laundromat_id, 
  full_name, 
  email, 
  phone,
  position, 
  can_view_revenue,
  can_manage_orders,
  can_contact_customers
) VALUES 
  -- Downtown Express Wash staff
  (
    'auth-user-uuid-1', 
    '550e8400-e29b-41d4-a716-446655440001', 
    'Sarah Johnson', 
    'sarah@downtownwash.com',
    '+1-313-555-0101',
    'manager', 
    true,   -- can view revenue
    true,   -- can manage orders
    true    -- can contact customers
  ),
  (
    'auth-user-uuid-2', 
    '550e8400-e29b-41d4-a716-446655440001', 
    'Mike Rodriguez', 
    'mike@downtownwash.com',
    '+1-313-555-0102',
    'staff', 
    false,  -- cannot view revenue
    true,   -- can manage orders
    true    -- can contact customers
  ),
  
  -- Midtown Wash & Fold staff
  (
    'auth-user-uuid-3', 
    '550e8400-e29b-41d4-a716-446655440002', 
    'Lisa Chen', 
    'lisa@midtownwash.com',
    '+1-313-555-0201',
    'owner', 
    true,   -- can view revenue
    true,   -- can manage orders
    true    -- can contact customers
  );
*/

-- Step 5: Verify the setup
-- Check staff assignments:
SELECT 
  ls.full_name,
  ls.email,
  ls.position,
  l.name as laundromat_name,
  ls.can_manage_orders,
  ls.can_view_revenue,
  ls.can_contact_customers
FROM laundromat_staff ls
JOIN laundromats l ON ls.laundromat_id = l.id
WHERE ls.is_active = true;

-- Check user roles:
SELECT 
  ur.auth_user_id,
  ur.role,
  ls.full_name,
  ls.email
FROM user_roles ur
JOIN laundromat_staff ls ON ur.auth_user_id = ls.auth_user_id
WHERE ur.role = 'laundromat_staff';

-- Test the helper function:
-- SELECT * FROM get_staff_laundromat('auth-user-uuid-here');

-- Useful queries for management:

-- 1. Find all staff for a specific laundromat:
/*
SELECT ls.*, l.name as laundromat_name 
FROM laundromat_staff ls 
JOIN laundromats l ON ls.laundromat_id = l.id 
WHERE l.name = 'Downtown Express Wash';
*/

-- 2. Find laundromat assignment for a specific user:
/*
SELECT l.name, ls.position, ls.can_view_revenue 
FROM laundromat_staff ls 
JOIN laundromats l ON ls.laundromat_id = l.id 
WHERE ls.auth_user_id = 'auth-user-uuid-here';
*/

-- 3. Update staff permissions:
/*
UPDATE laundromat_staff 
SET can_view_revenue = true, position = 'manager' 
WHERE auth_user_id = 'auth-user-uuid-here';
*/

-- 4. Deactivate a staff member:
/*
UPDATE laundromat_staff 
SET is_active = false 
WHERE auth_user_id = 'auth-user-uuid-here';
*/