-- Add refund-related columns to orders table
-- Run this migration to support order cancellation with Stripe refunds

-- Add refund amount column (in cents)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER DEFAULT 0;

-- Add refund reason column (human-readable description)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add Stripe refund ID column (for tracking refunds in Stripe)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- Add comment to explain these columns
COMMENT ON COLUMN orders.refund_amount_cents IS 'Amount refunded to customer in cents';
COMMENT ON COLUMN orders.refund_reason IS 'Human-readable reason for refund (e.g., "Full refund (cancelled 6+ hours before pickup)")';
COMMENT ON COLUMN orders.stripe_refund_id IS 'Stripe refund ID for tracking (e.g., "re_1ABC123...")';

-- Update the cancelled status in the check constraint if it doesn't exist yet
-- (This ensures 'cancelled' is a valid status value)
DO $$
BEGIN
    -- Check if constraint exists and update it
    IF EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE constraint_name = 'orders_status_check'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    END IF;

    -- Add updated constraint with all status values including 'cancelled'
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'scheduled',
        'confirmed',
        'picked_up',
        'in_progress',
        'ready_for_delivery',
        'out_for_delivery',
        'delivered',
        'completed',
        'cancelled'
    ));
END $$;
