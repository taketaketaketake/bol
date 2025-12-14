-- Update existing laundromat_staff table with missing columns and features
-- This is a safe migration that only adds what's missing

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add position column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'position') THEN
        ALTER TABLE laundromat_staff ADD COLUMN position TEXT DEFAULT 'staff';
    END IF;

    -- Add permission columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'can_manage_orders') THEN
        ALTER TABLE laundromat_staff ADD COLUMN can_manage_orders BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'can_view_revenue') THEN
        ALTER TABLE laundromat_staff ADD COLUMN can_view_revenue BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'can_contact_customers') THEN
        ALTER TABLE laundromat_staff ADD COLUMN can_contact_customers BOOLEAN DEFAULT true;
    END IF;

    -- Add phone column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'phone') THEN
        ALTER TABLE laundromat_staff ADD COLUMN phone TEXT;
    END IF;

    -- Add hired_date column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'hired_date') THEN
        ALTER TABLE laundromat_staff ADD COLUMN hired_date DATE DEFAULT CURRENT_DATE;
    END IF;

    -- Add updated_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'updated_at') THEN
        ALTER TABLE laundromat_staff ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add is_active column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'laundromat_staff' AND column_name = 'is_active') THEN
        ALTER TABLE laundromat_staff ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_laundromat_staff_auth_user_id ON laundromat_staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_laundromat_staff_laundromat_id ON laundromat_staff(laundromat_id);
CREATE INDEX IF NOT EXISTS idx_laundromat_staff_active ON laundromat_staff(is_active) WHERE is_active = true;

-- Create or replace updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS update_laundromat_staff_updated_at ON laundromat_staff;
CREATE TRIGGER update_laundromat_staff_updated_at 
  BEFORE UPDATE ON laundromat_staff 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS if not already enabled
ALTER TABLE laundromat_staff ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist
DO $$
BEGIN
    -- Drop existing policies if they exist (to recreate them)
    DROP POLICY IF EXISTS "Admins can view all laundromat staff" ON laundromat_staff;
    DROP POLICY IF EXISTS "Staff can view own laundromat staff" ON laundromat_staff;
    DROP POLICY IF EXISTS "Admins can manage laundromat staff" ON laundromat_staff;

    -- Create new policies
    CREATE POLICY "Admins can view all laundromat staff" ON laundromat_staff
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_roles.auth_user_id = auth.uid() 
          AND user_roles.role = 'admin'
        )
      );

    CREATE POLICY "Staff can view own laundromat staff" ON laundromat_staff
      FOR SELECT USING (
        auth_user_id = auth.uid() OR
        laundromat_id IN (
          SELECT laundromat_id FROM laundromat_staff 
          WHERE auth_user_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can manage laundromat staff" ON laundromat_staff
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_roles.auth_user_id = auth.uid() 
          AND user_roles.role = 'admin'
        )
      );
END $$;

-- Create or replace helper functions
CREATE OR REPLACE FUNCTION get_staff_laundromat(staff_user_id UUID)
RETURNS TABLE (
  laundromat_id UUID,
  laundromat_name TEXT,
  can_manage_orders BOOLEAN,
  can_view_revenue BOOLEAN,
  can_contact_customers BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.laundromat_id,
    l.name as laundromat_name,
    COALESCE(ls.can_manage_orders, true) as can_manage_orders,
    COALESCE(ls.can_view_revenue, false) as can_view_revenue,
    COALESCE(ls.can_contact_customers, true) as can_contact_customers
  FROM laundromat_staff ls
  JOIN laundromats l ON ls.laundromat_id = l.id
  WHERE ls.auth_user_id = staff_user_id 
    AND COALESCE(ls.is_active, true) = true 
    AND l.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace staff check function
CREATE OR REPLACE FUNCTION is_laundromat_staff(user_id UUID, check_laundromat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM laundromat_staff 
    WHERE auth_user_id = user_id 
      AND laundromat_id = check_laundromat_id
      AND COALESCE(is_active, true) = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view if it doesn't exist
DROP VIEW IF EXISTS laundromat_staff_with_details;
CREATE VIEW laundromat_staff_with_details AS
SELECT 
  ls.*,
  l.name as laundromat_name,
  l.city as laundromat_city,
  l.is_active as laundromat_active,
  CASE 
    WHEN ur.role = 'admin' THEN 'admin'
    ELSE 'laundromat_staff'
  END as effective_role
FROM laundromat_staff ls
JOIN laundromats l ON ls.laundromat_id = l.id
LEFT JOIN user_roles ur ON ls.auth_user_id = ur.auth_user_id AND ur.role = 'admin';

-- Grant permissions
GRANT SELECT ON laundromat_staff TO authenticated;
GRANT SELECT ON laundromat_staff_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_laundromat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_laundromat_staff(UUID, UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE laundromat_staff IS 'Staff members assigned to specific laundromats with role-based permissions';
COMMENT ON COLUMN laundromat_staff.position IS 'staff, manager, or owner - determines default permissions';
COMMENT ON COLUMN laundromat_staff.can_manage_orders IS 'Can update order status, weight, and communicate with customers';
COMMENT ON COLUMN laundromat_staff.can_view_revenue IS 'Can access financial data and revenue reports';
COMMENT ON COLUMN laundromat_staff.can_contact_customers IS 'Can send SMS messages and make calls to customers';

-- Show the final table structure
SELECT 
  'laundromat_staff table updated successfully' as status,
  COUNT(*) as total_staff_records
FROM laundromat_staff;