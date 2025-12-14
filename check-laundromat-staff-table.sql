-- Check the existing laundromat_staff table structure
-- Run these queries to see what's already there

-- 1. Check table structure
\d laundromat_staff;

-- 2. Check if data exists
SELECT COUNT(*) as total_staff FROM laundromat_staff;

-- 3. See what columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'laundromat_staff' 
ORDER BY ordinal_position;

-- 4. Check for indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'laundromat_staff';

-- 5. Check for RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'laundromat_staff';

-- 6. Check if helper functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('get_staff_laundromat', 'is_laundromat_staff');

-- 7. Sample data (if any)
SELECT 
  ls.*,
  l.name as laundromat_name
FROM laundromat_staff ls
LEFT JOIN laundromats l ON ls.laundromat_id = l.id
LIMIT 5;