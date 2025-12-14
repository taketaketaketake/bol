-- Add laundromat_staff table for proper user-to-laundromat assignments
-- This integrates with the existing role-based auth system

-- Create laundromat_staff table
CREATE TABLE laundromat_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  laundromat_id UUID NOT NULL REFERENCES laundromats(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT DEFAULT 'staff', -- staff, manager, owner
  is_active BOOLEAN DEFAULT true,
  can_manage_orders BOOLEAN DEFAULT true,
  can_view_revenue BOOLEAN DEFAULT false, -- Only managers/owners by default
  can_contact_customers BOOLEAN DEFAULT true,
  hired_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one staff record per user per laundromat
  UNIQUE(auth_user_id, laundromat_id),
  
  -- Ensure email is unique across all staff
  UNIQUE(email)
);

-- Create indexes for performance
CREATE INDEX idx_laundromat_staff_auth_user_id ON laundromat_staff(auth_user_id);
CREATE INDEX idx_laundromat_staff_laundromat_id ON laundromat_staff(laundromat_id);
CREATE INDEX idx_laundromat_staff_active ON laundromat_staff(is_active) WHERE is_active = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_laundromat_staff_updated_at 
  BEFORE UPDATE ON laundromat_staff 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE laundromat_staff ENABLE ROW LEVEL SECURITY;

-- Admins can see all staff
CREATE POLICY "Admins can view all laundromat staff" ON laundromat_staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.auth_user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Staff can see their own record and colleagues at same laundromat
CREATE POLICY "Staff can view own laundromat staff" ON laundromat_staff
  FOR SELECT USING (
    auth_user_id = auth.uid() OR
    laundromat_id IN (
      SELECT laundromat_id FROM laundromat_staff 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Only admins can insert/update staff records
CREATE POLICY "Admins can manage laundromat staff" ON laundromat_staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.auth_user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Add helpful views for common queries
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

-- Helper function to get staff member's assigned laundromat
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
    ls.can_manage_orders,
    ls.can_view_revenue,
    ls.can_contact_customers
  FROM laundromat_staff ls
  JOIN laundromats l ON ls.laundromat_id = l.id
  WHERE ls.auth_user_id = staff_user_id 
    AND ls.is_active = true 
    AND l.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is staff at specific laundromat
CREATE OR REPLACE FUNCTION is_laundromat_staff(user_id UUID, laundromat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM laundromat_staff 
    WHERE auth_user_id = user_id 
      AND laundromat_staff.laundromat_id = is_laundromat_staff.laundromat_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add some sample data (commented out - uncomment to populate)
/*
-- Sample laundromat staff (replace with real data)
INSERT INTO laundromat_staff (auth_user_id, laundromat_id, full_name, email, position, can_view_revenue) 
VALUES 
-- You'll need to replace these UUIDs with actual user IDs and laundromat IDs
-- ('user-uuid-here', 'laundromat-uuid-here', 'John Manager', 'john@laundromat.com', 'manager', true),
-- ('user-uuid-here', 'laundromat-uuid-here', 'Jane Staff', 'jane@laundromat.com', 'staff', false);

-- Don't forget to also add the laundromat_staff role to user_roles table:
-- INSERT INTO user_roles (auth_user_id, role) VALUES 
-- ('user-uuid-here', 'laundromat_staff');
*/

-- Add comments for documentation
COMMENT ON TABLE laundromat_staff IS 'Staff members assigned to specific laundromats with role-based permissions';
COMMENT ON COLUMN laundromat_staff.position IS 'staff, manager, or owner - determines default permissions';
COMMENT ON COLUMN laundromat_staff.can_manage_orders IS 'Can update order status, weight, and communicate with customers';
COMMENT ON COLUMN laundromat_staff.can_view_revenue IS 'Can access financial data and revenue reports';
COMMENT ON COLUMN laundromat_staff.can_contact_customers IS 'Can send SMS messages and make calls to customers';

-- Grant appropriate permissions
GRANT SELECT ON laundromat_staff TO authenticated;
GRANT SELECT ON laundromat_staff_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_laundromat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_laundromat_staff(UUID, UUID) TO authenticated;