-- Add address columns directly to orders table
-- This eliminates the need for joins and ensures address data is always available

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS pickup_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS pickup_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS pickup_address_city TEXT,
ADD COLUMN IF NOT EXISTS pickup_address_state TEXT,
ADD COLUMN IF NOT EXISTS pickup_address_postal_code TEXT,
ADD COLUMN IF NOT EXISTS dropoff_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS dropoff_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS dropoff_address_city TEXT,
ADD COLUMN IF NOT EXISTS dropoff_address_state TEXT,
ADD COLUMN IF NOT EXISTS dropoff_address_postal_code TEXT;

-- Make pickup address fields required (NOT NULL)
-- Run this after populating existing orders with address data
-- ALTER TABLE orders
-- ALTER COLUMN pickup_address_line1 SET NOT NULL,
-- ALTER COLUMN pickup_address_city SET NOT NULL,
-- ALTER COLUMN pickup_address_state SET NOT NULL,
-- ALTER COLUMN pickup_address_postal_code SET NOT NULL;
