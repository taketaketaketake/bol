# Capacity Management System

## Overview

The capacity management system controls how many orders can be scheduled for pickup/delivery at specific times in different service zones. This prevents overbooking and ensures operational efficiency.

## Database Schema

### Core Tables

#### `time_windows`
Defines available time slots for pickups and deliveries.

```sql
CREATE TABLE time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,           -- e.g., "Morning", "Afternoon", "Evening"
  start_time TIME NOT NULL,      -- e.g., "08:00:00"
  end_time TIME NOT NULL,        -- e.g., "12:00:00"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `service_zones`
Geographic areas where service is available.

```sql
CREATE TABLE service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- e.g., "Downtown Detroit"
  postal_codes TEXT[] NOT NULL,  -- Array of ZIP codes
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `daily_capacity`
Controls how many orders can be accepted for each time window/zone/date combination.

```sql
CREATE TABLE daily_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date DATE NOT NULL,
  zone_id UUID REFERENCES service_zones(id),
  time_window_id UUID REFERENCES time_windows(id),
  pickup_capacity INTEGER NOT NULL DEFAULT 10,  -- Max orders for this slot
  delivery_capacity INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(service_date, zone_id, time_window_id)
);
```

## SQL Functions

### `get_available_windows(service_date, zone_id)`

Returns available time windows with slot counts for a specific date and zone.

```sql
SELECT * FROM get_available_windows('2025-10-15', 'zone-uuid-here');
```

Returns:
- `time_window_id` - UUID of the time window
- `label` - Human readable name (Morning, Afternoon, etc.)
- `start_time` / `end_time` - Time range
- `total_capacity` - Maximum orders allowed
- `booked_orders` - Current number of orders
- `available_slots` - Remaining capacity

### `reserve_capacity(service_date, zone_id, time_window_id)`

Checks if capacity is available before creating an order.

```sql
SELECT reserve_capacity('2025-10-15', 'zone-uuid', 'window-uuid');
```

Returns `TRUE` if capacity is available, `FALSE` otherwise.

## Capacity Validation Trigger

The database uses a trigger to automatically validate capacity when orders are created:

```sql
-- Function that validates capacity
CREATE OR REPLACE FUNCTION validate_order_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_zone_id UUID;
  has_capacity BOOLEAN;
BEGIN
  -- Determine zone from address
  SELECT sz.id INTO v_zone_id
  FROM service_zones sz, addresses a
  WHERE a.id = NEW.address_id
    AND a.postal_code = ANY(sz.postal_codes);

  -- Check if capacity exists
  IF NOT reserve_capacity(NEW.pickup_date, v_zone_id, NEW.pickup_time_window_id) THEN
    RAISE EXCEPTION 'No capacity configured for this date/zone/window'
      USING ERRCODE = 'P0001';
  END IF;

  -- Set zone_id on the order
  NEW.zone_id := v_zone_id;

  RETURN NEW;
END;
$$;

-- Trigger that runs before order insert
CREATE TRIGGER check_capacity_before_order
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_capacity();
```

## Setting Up Capacity for Production

### 1. Create Time Windows

```sql
INSERT INTO time_windows (label, start_time, end_time, is_active) VALUES
  ('Morning', '08:00:00', '12:00:00', true),
  ('Afternoon', '12:00:00', '16:00:00', true),
  ('Evening', '16:00:00', '20:00:00', true);
```

### 2. Create Service Zones

```sql
INSERT INTO service_zones (name, postal_codes, is_active) VALUES
  ('Downtown Detroit', ARRAY['48201', '48202', '48226'], true),
  ('Midtown Detroit', ARRAY['48201', '48202'], true),
  ('East Detroit', ARRAY['48205', '48207', '48213'], true);
```

### 3. Set Up Daily Capacity

You need to create capacity records for each date you want to accept orders.

#### Option A: Manual for Specific Dates

```sql
-- Get zone and time window IDs first
SELECT id, name FROM service_zones;
SELECT id, label FROM time_windows;

-- Insert capacity for a specific date
INSERT INTO daily_capacity (service_date, zone_id, time_window_id, pickup_capacity, delivery_capacity)
VALUES
  ('2025-10-15', 'zone-uuid-here', 'morning-window-uuid', 20, 20),
  ('2025-10-15', 'zone-uuid-here', 'afternoon-window-uuid', 15, 15),
  ('2025-10-15', 'zone-uuid-here', 'evening-window-uuid', 10, 10);
```

#### Option B: Bulk Creation for Date Range

```sql
-- Create capacity for next 30 days for all zones/windows
INSERT INTO daily_capacity (service_date, zone_id, time_window_id, pickup_capacity, delivery_capacity)
SELECT
  d.service_date,
  sz.id as zone_id,
  tw.id as time_window_id,
  15 as pickup_capacity,    -- Default 15 pickups per window
  15 as delivery_capacity
FROM
  generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    INTERVAL '1 day'
  ) d(service_date)
CROSS JOIN service_zones sz
CROSS JOIN time_windows tw
WHERE
  sz.is_active = true
  AND tw.is_active = true
  -- Skip Sundays (optional)
  AND EXTRACT(DOW FROM d.service_date) != 0
ON CONFLICT (service_date, zone_id, time_window_id)
DO NOTHING;
```

### 4. Adjust Capacity for Specific Dates

```sql
-- Increase capacity for a busy date
UPDATE daily_capacity
SET pickup_capacity = 30, delivery_capacity = 30
WHERE service_date = '2025-12-24'  -- Christmas Eve
  AND zone_id = 'downtown-zone-uuid';

-- Reduce capacity for a slow day
UPDATE daily_capacity
SET pickup_capacity = 5, delivery_capacity = 5
WHERE service_date = '2025-07-04'  -- Independence Day
  AND zone_id = 'downtown-zone-uuid';

-- Block a specific time window
UPDATE daily_capacity
SET pickup_capacity = 0, delivery_capacity = 0
WHERE service_date = '2025-11-23'  -- Thanksgiving
  AND time_window_id = 'morning-window-uuid';
```

## Re-enabling Capacity Validation

Once you've set up capacity records, re-enable the trigger:

```sql
-- Run the SQL from the "Capacity Validation Trigger" section above
-- This will recreate the function and trigger
```

## Monitoring Capacity

### Check Current Availability

```sql
-- See available slots for a specific date and zone
SELECT
  tw.label as time_window,
  dc.pickup_capacity as max_capacity,
  COUNT(o.id) as booked_orders,
  dc.pickup_capacity - COUNT(o.id) as available_slots
FROM daily_capacity dc
JOIN time_windows tw ON tw.id = dc.time_window_id
LEFT JOIN orders o ON (
  o.pickup_date = dc.service_date
  AND o.pickup_time_window_id = dc.time_window_id
  AND o.zone_id = dc.zone_id
  AND o.status NOT IN ('canceled_by_customer', 'canceled_by_ops', 'no_show')
)
WHERE
  dc.service_date = '2025-10-15'
  AND dc.zone_id = 'zone-uuid-here'
GROUP BY tw.label, dc.pickup_capacity, tw.start_time
ORDER BY tw.start_time;
```

### Find Dates Missing Capacity

```sql
-- Find upcoming dates that don't have capacity configured
SELECT DISTINCT service_date
FROM generate_series(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '14 days',
  INTERVAL '1 day'
) d(service_date)
WHERE NOT EXISTS (
  SELECT 1 FROM daily_capacity dc
  WHERE dc.service_date = d.service_date
);
```

## Best Practices

1. **Set up rolling capacity** - Use a scheduled job to automatically create capacity for 30-60 days ahead
2. **Monitor utilization** - Track which time windows fill up quickly to adjust capacity
3. **Seasonal adjustments** - Increase capacity during busy seasons, reduce during slow periods
4. **Holiday planning** - Block or reduce capacity for holidays in advance
5. **Zone balancing** - Distribute capacity based on driver availability per zone
6. **Backup capacity** - Keep 10-20% buffer capacity for same-day urgent orders

## Troubleshooting

### Orders Failing with "No capacity configured"

1. Check if capacity record exists:
   ```sql
   SELECT * FROM daily_capacity
   WHERE service_date = 'date-here'
     AND zone_id = 'zone-here'
     AND time_window_id = 'window-here';
   ```

2. If missing, create it:
   ```sql
   INSERT INTO daily_capacity (service_date, zone_id, time_window_id, pickup_capacity, delivery_capacity)
   VALUES ('date-here', 'zone-uuid', 'window-uuid', 15, 15);
   ```

### Time Window Not Showing as Available

1. Check if slots are full:
   ```sql
   SELECT * FROM get_available_windows('date-here', 'zone-uuid-here');
   ```

2. Increase capacity if needed:
   ```sql
   UPDATE daily_capacity
   SET pickup_capacity = pickup_capacity + 10
   WHERE service_date = 'date-here'
     AND zone_id = 'zone-uuid'
     AND time_window_id = 'window-uuid';
   ```

## For Development/Testing

To temporarily disable capacity validation (already done via `disable-capacity-check.sql`):

```sql
DROP TRIGGER IF EXISTS check_capacity_before_order ON orders;
DROP FUNCTION IF EXISTS validate_order_capacity() CASCADE;
```

⚠️ **WARNING**: Only use this in development. In production, always have capacity validation enabled to prevent overbooking.
