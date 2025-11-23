-- ===================================================
-- DATABASE STRUCTURE ANALYSIS SCRIPT
-- Shows all tables, columns, and key relationships
-- ===================================================

-- Show all tables in the database
SELECT 
  schemaname as schema,
  tablename as table_name,
  tableowner as owner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Show detailed column information for all tables
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  CASE 
    WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
    WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
    ELSE ''
  END as key_type
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN (
  -- Primary keys
  SELECT 
    kcu.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
  -- Foreign keys
  SELECT 
    kcu.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- Show foreign key relationships
SELECT 
  tc.table_name as source_table,
  kcu.column_name as source_column,
  ccu.table_name as target_table,
  ccu.column_name as target_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Show indexes
SELECT 
  t.relname as table_name,
  i.relname as index_name,
  array_to_string(array_agg(a.attname), ', ') as columns
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON t.oid = a.attrelid
WHERE t.relkind = 'r'
  AND a.attnum = ANY(ix.indkey)
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.relname, i.relname
ORDER BY t.relname, i.relname;

-- Show functions (including our routing functions)
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_result(p.oid) as return_type,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- Only functions, not procedures
ORDER BY p.proname;

-- Show current laundromat setup
SELECT 
  l.name,
  l.zip_code,
  l.max_daily_orders,
  l.today_orders,
  l.is_active,
  array_agg(DISTINCT lsa.zip_code ORDER BY lsa.zip_code) as service_areas
FROM laundromats l
LEFT JOIN laundromat_service_areas lsa ON l.id = lsa.laundromat_id
GROUP BY l.id, l.name, l.zip_code, l.max_daily_orders, l.today_orders, l.is_active
ORDER BY l.name;

-- Test routing function with sample ZIP codes
SELECT '48201' as test_zip, * FROM find_laundromat_by_zip('48201');
SELECT '48209' as test_zip, * FROM find_laundromat_by_zip('48209');
SELECT '48226' as test_zip, * FROM find_laundromat_by_zip('48226');

-- Show recent orders and their laundromat assignments
SELECT 
  o.id,
  o.created_at,
  o.pickup_address_postal_code as zip,
  o.assigned_laundromat_id,
  l.name as laundromat_name,
  o.routing_method,
  o.status
FROM orders o
LEFT JOIN laundromats l ON o.assigned_laundromat_id = l.id
ORDER BY o.created_at DESC
LIMIT 10;