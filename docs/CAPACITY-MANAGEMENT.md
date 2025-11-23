# Laundromat Capacity Management System

## Overview

The capacity management system controls how many orders each partner laundromat can handle per day. Orders are automatically assigned to the least busy laundromat serving the customer's ZIP code, ensuring optimal load balancing and preventing overbooking.

## Database Schema

### Core Tables

#### `laundromats`
Partner laundromat locations with capacity management fields.

```sql
CREATE TABLE laundromats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Midtown Wash & Fold"
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  zip_code TEXT,                         -- Primary ZIP where laundromat is located
  phone TEXT,
  contact_email TEXT,
  notification_phone TEXT,
  
  -- Capacity Management
  max_daily_orders INTEGER DEFAULT 50,   -- Maximum orders per day
  today_orders INTEGER DEFAULT 0,        -- Current daily order count
  
  -- Operational Settings
  is_active BOOLEAN DEFAULT true,
  radius_miles INTEGER DEFAULT 5,
  operates_morning BOOLEAN DEFAULT true,
  operates_afternoon BOOLEAN DEFAULT true,
  operates_evening BOOLEAN DEFAULT true,
  avg_turnaround_hours INTEGER DEFAULT 24,
  
  -- Payment Integration
  stripe_connect_id TEXT,               -- For partner payouts
  
  -- Geographic Data
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `laundromat_service_areas`
Many-to-many mapping of laundromats to ZIP codes they serve.

```sql
CREATE TABLE laundromat_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundromat_id UUID NOT NULL REFERENCES laundromats(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,               -- ZIP code served by this laundromat
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(laundromat_id, zip_code)
);
```

#### `orders` (Updated)
Orders table now includes laundromat assignment fields.

```sql
-- New fields added to existing orders table
ALTER TABLE orders 
ADD COLUMN assigned_laundromat_id UUID REFERENCES laundromats(id),
ADD COLUMN routing_method TEXT DEFAULT 'zip_match',
ADD COLUMN assigned_at TIMESTAMPTZ;
```

## Routing Functions

### `find_laundromat_by_zip(incoming_zip)`

Returns available laundromats for a ZIP code, ordered by current capacity (least busy first).

```sql
SELECT * FROM find_laundromat_by_zip('48201');
```

Returns:
- `id` - Laundromat UUID
- `name` - Laundromat name
- `today_orders` - Current daily order count
- `max_daily_orders` - Maximum capacity
- `capacity_remaining` - Available slots today
- `stripe_connect_id` - Payment routing ID
- `contact_email` - Notification email
- `avg_turnaround_hours` - Expected completion time

### `assign_order_to_laundromat(order_id, laundromat_id)`

Assigns an order to a laundromat and increments their daily counter.

```sql
SELECT assign_order_to_laundromat('order-uuid', 'laundromat-uuid');
```

Returns `TRUE` if successful, `FALSE` otherwise.

### `get_laundromat_capacity(laundromat_id)`

Get current capacity status for a specific laundromat.

```sql
SELECT * FROM get_laundromat_capacity('laundromat-uuid');
```

Returns:
- `name` - Laundromat name
- `today_orders` - Current daily orders
- `max_daily_orders` - Maximum capacity
- `capacity_remaining` - Available slots
- `utilization_percent` - Current utilization percentage

### `reset_daily_laundromat_counters()`

Resets all daily order counters to 0. Should be run via cron daily at midnight.

```sql
SELECT reset_daily_laundromat_counters();
```

## Automatic Order Routing

### How It Works

1. **Customer places order** with pickup ZIP code
2. **System finds laundromats** serving that ZIP using `laundromat_service_areas`
3. **Filters by availability** - only laundromats with `today_orders < max_daily_orders`
4. **Sorts by load** - least busy laundromat gets the order
5. **Assigns automatically** and increments counter

### API Integration

The routing happens automatically in the order creation API (`/api/create-order`):

```typescript
// Automatic laundromat assignment based on pickup ZIP code
const pickupZip = pickupAddress.postal_code || pickupAddress.zip;
if (pickupZip) {
  const { data: availableLaundromats } = await serviceClient
    .rpc('find_laundromat_by_zip', { incoming_zip: pickupZip });

  if (availableLaundromats && availableLaundromats.length > 0) {
    const assignedLaundromat = availableLaundromats[0]; // Least busy
    await serviceClient.rpc('assign_order_to_laundromat', { 
      order_id: order.id, 
      laundromat_id: assignedLaundromat.id 
    });
  }
}
```

## Setting Up Capacity for Production

### 1. Add Laundromats

```sql
INSERT INTO laundromats (name, address, city, state, zip_code, phone, max_daily_orders, is_active) VALUES
('Downtown Express Wash', '1234 Griswold St', 'Detroit', 'MI', '48226', '(313) 555-0103', 50, true),
('Midtown Wash & Fold', '4801 Cass Ave', 'Detroit', 'MI', '48201', '(313) 555-0101', 40, true),
('Westside Laundry Hub', '8200 W Vernor Hwy', 'Detroit', 'MI', '48209', '(313) 555-0102', 35, true);
```

### 2. Set Up Service Areas

Map each laundromat to the ZIP codes they can serve:

```sql
-- Get laundromat IDs
SELECT id, name FROM laundromats;

-- Assign service areas
INSERT INTO laundromat_service_areas (laundromat_id, zip_code) VALUES
-- Downtown Express Wash serves downtown and nearby
('downtown-laundromat-uuid', '48226'),
('downtown-laundromat-uuid', '48201'),
('downtown-laundromat-uuid', '48243'),

-- Midtown serves midtown area
('midtown-laundromat-uuid', '48201'),
('midtown-laundromat-uuid', '48202'),
('midtown-laundromat-uuid', '48226'),

-- Westside serves western Detroit
('westside-laundromat-uuid', '48209'),
('westside-laundromat-uuid', '48210'),
('westside-laundromat-uuid', '48228');
```

### 3. Set Daily Capacity Limits

Adjust maximum daily orders based on each laundromat's capacity:

```sql
-- High-volume locations
UPDATE laundromats SET max_daily_orders = 60 WHERE name = 'Downtown Express Wash';

-- Medium-volume locations  
UPDATE laundromats SET max_daily_orders = 40 WHERE name = 'Midtown Wash & Fold';

-- Smaller operations
UPDATE laundromats SET max_daily_orders = 25 WHERE name = 'Westside Laundry Hub';
```

### 4. Set Up Daily Reset (Cron Job)

Create a cron job to reset daily counters at midnight:

```bash
# Add to crontab (crontab -e)
0 0 * * * psql "$DATABASE_URL" -c "SELECT reset_daily_laundromat_counters();"
```

Or use a scheduled function in your hosting platform.

## Monitoring Capacity

### Check Current Load Distribution

```sql
-- See current capacity utilization across all laundromats
SELECT 
  name,
  today_orders,
  max_daily_orders,
  (max_daily_orders - today_orders) as remaining_capacity,
  ROUND((today_orders::numeric / max_daily_orders::numeric) * 100, 1) as utilization_percent
FROM laundromats 
WHERE is_active = true
ORDER BY utilization_percent DESC;
```

### Check Service Coverage

```sql
-- See which ZIP codes are covered and by how many laundromats
SELECT 
  lsa.zip_code,
  COUNT(*) as laundromat_count,
  string_agg(l.name, ', ') as served_by
FROM laundromat_service_areas lsa
JOIN laundromats l ON lsa.laundromat_id = l.id
WHERE l.is_active = true
GROUP BY lsa.zip_code
ORDER BY lsa.zip_code;
```

### Find Uncovered ZIP Codes

```sql
-- Check recent orders that couldn't be routed (no laundromat assigned)
SELECT 
  pickup_address_postal_code as zip_code,
  COUNT(*) as unrouted_orders
FROM orders 
WHERE assigned_laundromat_id IS NULL 
  AND created_at > NOW() - INTERVAL '7 days'
  AND pickup_address_postal_code IS NOT NULL
GROUP BY pickup_address_postal_code
ORDER BY unrouted_orders DESC;
```

### Daily Capacity Report

```sql
-- Daily capacity summary
WITH capacity_stats AS (
  SELECT 
    l.name,
    l.today_orders,
    l.max_daily_orders,
    (l.max_daily_orders - l.today_orders) as remaining,
    ROUND((l.today_orders::numeric / l.max_daily_orders::numeric) * 100, 1) as utilization
  FROM laundromats l 
  WHERE l.is_active = true
)
SELECT 
  'Total Orders Today' as metric,
  SUM(today_orders)::text as value
FROM capacity_stats
UNION ALL
SELECT 
  'Total Capacity',
  SUM(max_daily_orders)::text
FROM capacity_stats
UNION ALL
SELECT 
  'Available Slots',
  SUM(remaining)::text  
FROM capacity_stats
UNION ALL
SELECT 
  'Average Utilization',
  ROUND(AVG(utilization), 1)::text || '%'
FROM capacity_stats;
```

## Managing Capacity

### Temporarily Increase Capacity

```sql
-- For busy days or special events
UPDATE laundromats 
SET max_daily_orders = max_daily_orders + 10
WHERE name = 'Downtown Express Wash';
```

### Temporarily Disable a Laundromat

```sql
-- For maintenance or holidays
UPDATE laundromats 
SET is_active = false 
WHERE name = 'Midtown Wash & Fold';

-- Re-enable later
UPDATE laundromats 
SET is_active = true 
WHERE name = 'Midtown Wash & Fold';
```

### Add New Service Areas

```sql
-- Expand a laundromat's service area
INSERT INTO laundromat_service_areas (laundromat_id, zip_code) 
SELECT id, '48204' 
FROM laundromats 
WHERE name = 'Downtown Express Wash';
```

### Manual Order Reassignment

Use the assignment API endpoint to manually assign orders:

```bash
# Assign specific order to specific laundromat
curl -X POST /api/assign-laundromat \
  -H "Content-Type: application/json" \
  -d '{"orderId": "order-uuid", "laundromatId": "laundromat-uuid"}'

# Auto-assign based on ZIP code
curl -X POST /api/assign-laundromat \
  -H "Content-Type: application/json" \
  -d '{"orderId": "order-uuid", "zipCode": "48201"}'
```

## Best Practices

1. **Load Balancing** - System automatically assigns to least busy laundromat
2. **Redundancy** - Have multiple laundromats serve overlapping ZIP codes
3. **Capacity Monitoring** - Set up alerts when utilization > 80%
4. **Partner Communication** - Send daily capacity reports to partner laundromats
5. **Seasonal Adjustments** - Temporarily increase capacity during busy periods
6. **Geographic Optimization** - Assign laundromats to ZIP codes based on proximity

## Troubleshooting

### Orders Not Getting Assigned

1. **Check service area coverage**:
   ```sql
   SELECT * FROM find_laundromat_by_zip('zip-code-here');
   ```

2. **If no results, add service area**:
   ```sql
   INSERT INTO laundromat_service_areas (laundromat_id, zip_code) 
   VALUES ('nearest-laundromat-uuid', 'zip-code-here');
   ```

### Laundromat at Full Capacity

1. **Check current load**:
   ```sql
   SELECT * FROM get_laundromat_capacity('laundromat-uuid');
   ```

2. **Temporarily increase capacity**:
   ```sql
   UPDATE laundromats SET max_daily_orders = max_daily_orders + 5
   WHERE id = 'laundromat-uuid';
   ```

### Daily Counters Not Resetting

1. **Manually reset**:
   ```sql
   SELECT reset_daily_laundromat_counters();
   ```

2. **Check cron job is running** or set up scheduled function

## Migration from Zone-Based System

The old zone-based capacity system (`service_zones`, `daily_capacity`) has been completely replaced with this laundromat-centric approach. Key differences:

- ✅ **Automatic load balancing** instead of manual capacity planning
- ✅ **Real-time capacity tracking** instead of pre-allocated slots  
- ✅ **Partner-focused** routing for better business relationships
- ✅ **Simplified operations** - no daily capacity setup required
- ✅ **Better scalability** - easy to add new partners and service areas

All existing orders have been migrated to use the new `assigned_laundromat_id` field.