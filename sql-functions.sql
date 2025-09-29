-- SQL functions for availability checking

-- Function to get available time windows for a specific date and zone
DROP FUNCTION IF EXISTS get_available_windows(DATE, UUID);
CREATE FUNCTION get_available_windows(
  service_date DATE,
  zone_id UUID
)
RETURNS TABLE (
  time_window_id UUID,
  label TEXT,
  start_time TIME,
  end_time TIME,
  total_capacity INTEGER,
  booked_orders BIGINT,
  available_slots INTEGER
)
LANGUAGE SQL
AS $$
  SELECT
    tw.id as time_window_id,
    tw.label,
    tw.start_time,
    tw.end_time,
    COALESCE(dc.pickup_capacity, 10) as total_capacity,
    COUNT(o.id) as booked_orders,
    GREATEST(0, COALESCE(dc.pickup_capacity, 10) - COUNT(o.id)::INTEGER) as available_slots
  FROM time_windows tw
  LEFT JOIN daily_capacity dc ON (
    dc.time_window_id = tw.id
    AND dc.zone_id = $2
    AND dc.service_date = $1
  )
  LEFT JOIN orders o ON (
    o.pickup_time_window_id = tw.id
    AND o.pickup_date = $1
    AND o.zone_id = $2
    AND o.status NOT IN ('canceled_by_customer', 'canceled_by_ops', 'no_show')
  )
  WHERE tw.is_active = true
  GROUP BY tw.id, tw.label, tw.start_time, tw.end_time, dc.pickup_capacity
  HAVING GREATEST(0, COALESCE(dc.pickup_capacity, 10) - COUNT(o.id)::INTEGER) > 0
  ORDER BY tw.start_time;
$$;

-- Function to match zone for postal code
DROP FUNCTION IF EXISTS match_zone_for_postal(text);
CREATE FUNCTION match_zone_for_postal(postal_code TEXT)
RETURNS TABLE (
  zone_id UUID,
  zone_name TEXT
)
LANGUAGE SQL
AS $$
  SELECT id, name
  FROM service_zones
  WHERE postal_codes @> ARRAY[postal_code];
$$;

-- Function to reserve capacity (called when order is placed)
CREATE OR REPLACE FUNCTION reserve_capacity(
  service_date DATE,
  zone_id UUID,
  time_window_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  available_slots INTEGER;
BEGIN
  -- Check if there are available slots
  SELECT get_available_windows.available_slots INTO available_slots
  FROM get_available_windows(service_date, zone_id)
  WHERE get_available_windows.time_window_id = reserve_capacity.time_window_id;

  -- If no slots available, return false
  IF available_slots IS NULL OR available_slots <= 0 THEN
    RETURN FALSE;
  END IF;

  -- If slots are available, return true (order creation will handle the actual reservation)
  RETURN TRUE;
END;
$$;