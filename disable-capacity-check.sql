-- Temporary: Disable capacity validation trigger for testing
-- WARNING: This allows orders to be created without checking availability
-- Re-enable this in production after setting up proper capacity management

-- Drop the trigger that validates capacity on order creation
DROP TRIGGER IF EXISTS check_capacity_before_order ON orders;

-- Drop the function that the trigger calls (if it exists)
DROP FUNCTION IF EXISTS validate_order_capacity() CASCADE;

-- Note: To re-enable capacity validation in production:
-- 1. Set up capacity records in daily_capacity table
-- 2. Recreate the trigger using the SQL in CAPACITY-MANAGEMENT.md
