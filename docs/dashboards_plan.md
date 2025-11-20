Multi-Dashboard Architecture Plan
You're absolutely right - I completely missed that! You need three distinct dashboards with different data, permissions, and functionality.

Dashboard Breakdown by User Type
1. Customer Dashboard (Current /dashboard.astro)
User: Regular customers placing laundry orders
Auth: Supabase Auth → customers table via auth_user_id
2. Admin Dashboard (New - needs creation)
User: Business operators managing all orders, capacity, drivers
Auth: Supabase Auth with admin role check
Path: /admin/dashboard or /admin
3. Driver Dashboard (New - needs creation)
User: Drivers viewing assigned pickups/deliveries
Auth: Supabase Auth → drivers table via auth_user_id
Path: /driver/dashboard or /driver

Revised File Structure
src/
├── pages/
│   ├── dashboard.astro                    # Customer dashboard (existing)
│   ├── admin/
│   │   ├── dashboard.astro                # Admin overview
│   │   ├── orders.astro                   # All orders management
│   │   ├── capacity.astro                 # Daily capacity management
│   │   ├── drivers.astro                  # Driver assignments
│   │   └── customers.astro                # Customer management
│   └── driver/
│       ├── dashboard.astro                # Driver daily assignments
│       └── route.astro                    # Route optimization view
│
├── utils/
│   ├── dashboard/
│   │   ├── customer.ts                    # Customer-specific queries
│   │   ├── admin.ts                       # Admin-specific queries
│   │   └── driver.ts                      # Driver-specific queries
│   ├── auth/
│   │   └── roles.ts                       # Role checking utilities
│   ├── formatters.ts                      # Shared formatting (all dashboards)
│   └── orderHelpers.ts                    # Shared order logic
│
├── types/
│   ├── customer-dashboard.ts
│   ├── admin-dashboard.ts
│   └── driver-dashboard.ts
│
└── components/
    ├── customer/
    │   ├── OrderCard.tsx
    │   └── UpcomingPickup.tsx
    ├── admin/
    │   ├── OrderTable.tsx
    │   ├── CapacityCalendar.tsx
    │   └── DriverAssignment.tsx
    └── driver/
        ├── RouteMap.tsx
        └── StopCard.tsx

1. Customer Dashboard
Data Needs:

✅ Their own orders only
✅ Their addresses
✅ Their membership status
✅ Upcoming pickups/deliveries
✅ Order history

Key Queries (utils/dashboard/customer.ts):
typescript// Links auth user → customer record
getCustomerByAuthId(authUserId: string)

// Customer's orders filtered by status
getCustomerActiveOrders(customerId: string)
getCustomerUpcomingPickups(customerId: string)
getCustomerOrderHistory(customerId: string, limit: number)

// Customer's saved addresses
getCustomerAddresses(customerId: string)

// Membership info
getCustomerMembership(customerId: string)

// Stats for display
getCustomerStats(customerId: string) // total orders, total spent, etc.
UI Components:

Order status cards
Upcoming pickup cards
Order history list
Quick actions (schedule new pickup, edit profile)
Membership status banner (if applicable)

Permissions:

Can only see their own data
Cannot see other customers
Cannot see driver assignments
Cannot modify capacity


2. Admin Dashboard
Data Needs:

📊 Overview metrics: Today's pickups, deliveries, revenue
📦 All orders: Every customer's orders with filters
🗓️ Capacity management: Daily capacity by zone/window
🚗 Driver assignments: Who's working when/where
👥 Customer list: All customers, search, stats
📈 Analytics: Revenue trends, order volume, zone performance

Key Queries (utils/dashboard/admin.ts):
typescript// Dashboard overview
getAdminDashboardMetrics(date?: Date) {
  // Returns:
  // - Total orders today
  // - Revenue today/week/month
  // - Active drivers count
  // - Pending orders count
  // - Capacity utilization %
}

// Orders management
getAllOrders(filters: OrderFilters, pagination: Pagination)
// Filters: status, date range, zone, customer, driver

getOrdersByStatus(status: string[])
getOrdersByDateRange(startDate: Date, endDate: Date)
getOrdersByZone(zoneId: string)

// Capacity management
getDailyCapacity(date: Date) {
  // Join: daily_capacity + time_windows + service_zones
  // Show: capacity vs booked for each zone/window
}

getCapacityUtilization(dateRange: DateRange) {
  // Use window_load view
}

updateDailyCapacity(params: CapacityUpdate)

// Driver management
getAllDrivers()
getDriverAssignments(date: Date)
assignDriver(driverId: string, zoneId: string, date: Date, windowId: string)
getDriverPerformance(driverId: string, dateRange: DateRange)

// Customer management
getAllCustomers(search?: string, pagination?: Pagination)
getCustomerDetails(customerId: string) // includes order history, lifetime value

// Analytics
getRevenueByDateRange(start: Date, end: Date)
getOrderVolumeByZone(dateRange: DateRange)
getPopularTimeWindows()
UI Components:

Dashboard Cards: Metrics overview (today's orders, revenue, alerts)
Order Management Table: Sortable, filterable, bulk actions
Capacity Calendar: Visual grid showing capacity vs bookings
Driver Assignment Interface: Drag-and-drop or form-based
Customer Search: Search by name, email, phone
Analytics Charts: Revenue trends, zone heatmap, time window demand

Permissions:

See all customers, orders, drivers
Modify capacity settings
Assign/reassign drivers
Cancel/modify any order
Access analytics and reports
Manage service zones and time windows

Critical Admin Features:

Order Override: Change status, reassign driver, adjust pricing
Capacity Planning: Set capacity per zone/window for future dates
Driver Scheduling: Weekly view of driver availability
Alerts/Notifications: Low capacity warnings, unassigned orders
Bulk Operations: Export orders to CSV, batch status updates


3. Driver Dashboard
Data Needs:

📍 Today's route: Assigned pickups and deliveries
🗺️ Stop details: Address, customer phone, notes, order details
✅ Action buttons: Mark picked up, mark delivered, report issues
📅 Schedule: Future assignments
📊 Performance: Completed orders, on-time rate

Key Queries (utils/dashboard/driver.ts):
typescript// Link auth user → driver record
getDriverByAuthId(authUserId: string)

// Today's assignments
getDriverTodayRoute(driverId: string, date: Date) {
  // Returns orders assigned to this driver for today
  // Grouped by: pickups (morning), deliveries (afternoon)
  // Sorted by: zone, then time window, then address proximity
  // Includes: customer name, phone, address, notes, preferences
}

// Update order status (driver actions)
markOrderPickedUp(orderId: string, driverId: string, timestamp: Date, actualWeight?: number)
markOrderDelivered(orderId: string, driverId: string, timestamp: Date)
reportIssue(orderId: string, driverId: string, issue: IssueReport)

// Driver schedule
getDriverSchedule(driverId: string, dateRange: DateRange) {
  // Shows driver_assignments for upcoming days
  // Includes: zone, time window, estimated order count
}

// Driver stats
getDriverStats(driverId: string, dateRange: DateRange) {
  // Returns: total orders completed, on-time %, customer ratings (future)
}

// Navigation helper
getOptimizedRoute(stops: Stop[]) {
  // Future: integrate with mapping API
  // For now: return stops sorted by proximity
}
UI Components:

Daily Route Card: List of stops with addresses
Stop Details: Expandable cards with customer info, order details
Action Buttons: Large, touch-friendly for mobile use
Map View: Visual route (Google Maps integration)
Issue Reporter: Quick form for customer not home, damaged items, etc.
Schedule View: Calendar of upcoming assignments

Permissions:

See only their own assignments
Cannot see other drivers' routes
Cannot see all orders (only assigned ones)
Cannot modify capacity or assignments
Can update order status (picked up, delivered)
Can add driver notes to orders

Critical Driver Features:

Mobile-First Design: Large buttons, easy one-hand use
Offline Support: Cache route data, sync when online
GPS Integration: "Navigate to next stop" button
Customer Contact: Click-to-call phone numbers
Photo Upload: Document issues or completed deliveries
Weight Input: Enter actual measured weight at pickup


Role & Permission System
Authentication Flow:
typescript// utils/auth/roles.ts

export async function getUserRole(authUserId: string): Promise<UserRole> {
  // Check if user is in drivers table
  const driver = await supabase
    .from('drivers')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  
  if (driver.data) return 'driver';
  
  // Check if user is admin (multiple options):
  // Option 1: Check auth.users metadata
  const { data: user } = await supabase.auth.getUser();
  if (user?.user_metadata?.role === 'admin') return 'admin';
  
  // Option 2: Separate admins table (recommended)
  // const admin = await supabase.from('admins').select('id')...
  
  // Default: customer
  return 'customer';
}

export async function requireRole(cookies: AstroCookies, allowedRoles: UserRole[]) {
  const session = await getSession(cookies);
  if (!session) throw new Error('Not authenticated');
  
  const role = await getUserRole(session.user.id);
  if (!allowedRoles.includes(role)) {
    throw new Error('Insufficient permissions');
  }
  
  return { session, role };
}
Page Protection:
astro---
// admin/dashboard.astro
import { requireRole } from '../utils/auth/roles';

const { session, role } = await requireRole(Astro.cookies, ['admin']);
// If not admin, requireRole throws error → triggers error page
---
Role-Based Header:
astro// components/SiteHeader.tsx (already has session)
{session && (
  <>
    {userRole === 'customer' && <a href="/dashboard">My Orders</a>}
    {userRole === 'admin' && <a href="/admin/dashboard">Admin</a>}
    {userRole === 'driver' && <a href="/driver/dashboard">My Route</a>}
  </>
)}

Database Considerations
Missing Table: admins (Recommended to add)
sqlCREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  permissions JSONB DEFAULT '{"all": true}', -- For fine-grained permissions later
  created_at TIMESTAMPTZ DEFAULT NOW()
);
Row-Level Security (RLS):
Orders table:
sql-- Customers can only see their own orders
CREATE POLICY customer_orders ON orders
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Drivers can only see assigned orders
CREATE POLICY driver_orders ON orders
  FOR SELECT
  USING (
    -- Need to add driver_id to orders table first!
    driver_id IN (
      SELECT id FROM drivers WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can see all orders
CREATE POLICY admin_orders ON orders
  FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM admins)
  );
Schema Updates Needed:

Add driver_id to orders table:

sqlALTER TABLE orders ADD COLUMN driver_id UUID REFERENCES drivers(id);
CREATE INDEX idx_orders_driver_id ON orders(driver_id);

Consider adding assigned_driver_id vs actual_driver_id:

assigned_driver_id: Who's scheduled
actual_driver_id: Who actually did it (if different)




Shared Utilities
utils/formatters.ts (Used by ALL dashboards)

✅ formatCurrency()
✅ formatDate()
✅ formatWeight()
✅ formatTimeWindow()
✅ formatOrderStatus()
✅ formatAddress()
✅ formatPhoneNumber()

utils/orderHelpers.ts (Shared logic)

✅ canCancelOrder()
✅ canRescheduleOrder()
✅ getOrderProgress()
✅ calculateOrderTotal()
✅ validateOrderStatus()


Navigation Strategy
Unified Header with Role Detection:
astro// components/SiteHeader.astro
{session && (
  <nav>
    {role === 'customer' && (
      <>
        <a href="/dashboard">Dashboard</a>
        <a href="/start-basic">New Order</a>
        <a href="/dashboard/profile">Profile</a>
      </>
    )}
    
    {role === 'admin' && (
      <>
        <a href="/admin/dashboard">Dashboard</a>
        <a href="/admin/orders">Orders</a>
        <a href="/admin/capacity">Capacity</a>
        <a href="/admin/drivers">Drivers</a>
        <a href="/admin/customers">Customers</a>
      </>
    )}
    
    {role === 'driver' && (
      <>
        <a href="/driver/dashboard">Today's Route</a>
        <a href="/driver/schedule">Schedule</a>
        <a href="/driver/history">History</a>
      </>
    )}
  </nav>
)}
Smart Redirect After Login:
astro// pages/auth/callback.astro
const role = await getUserRole(session.user.id);

const redirectMap = {
  'customer': '/dashboard',
  'admin': '/admin/dashboard',
  'driver': '/driver/dashboard'
};

return Astro.redirect(redirectMap[role]);

Implementation Priority
Phase 1: Customer Dashboard (Current Focus)

✅ Already started
Complete with real data from orders table
This is highest priority (customer-facing)

Phase 2: Admin Dashboard (Business Critical)

Build admin role checking
Create admin order management interface
Add capacity management
This unblocks operations team

Phase 3: Driver Dashboard (Operational)

Build driver mobile interface
Route optimization
Status updates
This improves driver efficiency


Key Decisions Needed

Admin Role Storage:

Option A: Separate admins table (recommended - cleaner)
Option B: User metadata in Supabase Auth
Option C: Special flag in customers table (not recommended)


Driver Assignment:

Add driver_id directly to orders table? (YES - needed)
Or rely solely on driver_assignments table? (Too complex)


Permission Granularity:

Start with role-based (customer/admin/driver)
Later: Fine-grained permissions (admin can do X but not Y)


Multi-Role Support:

Can someone be both customer AND driver? (e.g., employee who also uses service)
If yes, need role switcher in UI


Guest Orders:

How do guest orders appear in admin dashboard?
Should guests have limited dashboard access via email link?