-- RLS policy to allow viewing orders using the magic link access token
-- This allows guests to view their orders without authentication

-- Policy for orders table
CREATE POLICY "Allow viewing orders with valid access token"
ON orders
FOR SELECT
USING (
  -- Allow if the access token matches and hasn't expired
  access_token IS NOT NULL
  AND token_expires_at > NOW()
);

-- Policy for customers table (needed for the join)
CREATE POLICY "Allow viewing customer data for orders with valid token"
ON customers
FOR SELECT
USING (
  -- Allow if there's an order with a valid access token for this customer
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.customer_id = customers.id
    AND orders.access_token IS NOT NULL
    AND orders.token_expires_at > NOW()
  )
);

-- Note: You may need to enable RLS on these tables first if not already enabled:
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
