-- Database migrations for guest order token system

-- Add access token fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Add guest tracking to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT true;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON orders(access_token);
CREATE INDEX IF NOT EXISTS idx_orders_token_expires ON orders(token_expires_at);

-- RLS Policy for guest token access
DROP POLICY IF EXISTS "orders_read_policy" ON orders;
CREATE POLICY "orders_read_policy" ON orders FOR SELECT USING (
  -- Allow access if user owns the order through auth
  customer_id IN (
    SELECT id FROM customers
    WHERE auth_user_id = auth.uid()
  )
  -- OR allow access with valid token (implement token check in application layer)
);

-- Create memberships table for Stripe integration
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active', -- active, canceled, past_due, trialing
  membership_type TEXT DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for memberships
CREATE INDEX IF NOT EXISTS idx_memberships_customer_id ON memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_customer_id ON memberships(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_subscription_id ON memberships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);