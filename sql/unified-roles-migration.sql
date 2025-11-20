-- Unified Role System Migration
-- Creates secure view for role-based access control

-- 1. Create unified role view
CREATE VIEW user_roles AS
SELECT auth_user_id, 'admin' AS role FROM admins
UNION
SELECT auth_user_id, 'driver' AS role FROM drivers  
UNION
SELECT auth_user_id, 'customer' AS role FROM customers;

-- 2. Security: Restrict access to service role only
-- Note: Adjust 'service_role_user' to match your actual service role username
-- ALTER VIEW user_roles OWNER TO service_role_user;
REVOKE ALL ON user_roles FROM public;

-- 3. Performance: Add index for fast auth_user_id lookups
CREATE INDEX idx_user_roles_auth_user_id ON user_roles(auth_user_id);

-- 4. Grant access to authenticated users (for API routes using service role)
-- This allows your API routes to query the view when using service role key
GRANT SELECT ON user_roles TO service_role;

-- Verification queries (run these to test):
-- SELECT * FROM user_roles WHERE auth_user_id = 'your-test-user-id';
-- SELECT role FROM user_roles WHERE auth_user_id = 'admin-user-id';