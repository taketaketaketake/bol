-- Migration: Add SMS Support
-- Description: Add SMS opt-in to customers and update notifications constraints for SMS events
-- Created: 2025-11-18

-- Add SMS opt-in field to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;

-- Comment on the column
COMMENT ON COLUMN customers.sms_opt_in IS 'Customer consent for SMS notifications (TCPA compliance)';

-- Drop existing constraint if it exists (to update it)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_event_check;

-- Add updated constraint allowing all SMS events
ALTER TABLE notifications
ADD CONSTRAINT notifications_event_check CHECK (
  event IN (
    -- Email events
    'order_confirmed',
    'new_order_alert',
    'payment_failed',
    'delivery_complete',
    'pickup_complete',
    -- SMS events
    'en_route_pickup',
    'en_route_delivery',
    'ready_for_delivery',
    -- Membership events
    'membership_created',
    'membership_renewed',
    'membership_cancelled'
  )
);

-- Drop existing channel constraint if it exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;

-- Add constraint for allowed notification channels
ALTER TABLE notifications
ADD CONSTRAINT notifications_channel_check CHECK (
  channel IN ('email', 'sms', 'push')
);

-- Create index on notifications for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_order_event ON notifications(order_id, event);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);

-- Create index on customers sms_opt_in for filtering
CREATE INDEX IF NOT EXISTS idx_customers_sms_opt_in ON customers(sms_opt_in) WHERE sms_opt_in = true;
