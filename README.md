# Bags of Laundry - Professional Laundry Service Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Astro](https://img.shields.io/badge/Astro-5.7+-FF5D01?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Latest-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Latest-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-181818?logo=supabase&logoColor=white)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Latest-008CDD?logo=stripe&logoColor=white)](https://stripe.com/)

A comprehensive, production-ready laundry service platform built with modern web technologies, featuring complete driver workflow management, unified role-based access control, real-time capacity management, and integrated payment processing.

## ✨ Core Features

### 🚛 **Complete Driver Workflow System**
- **4-Stage Driver Process**: Customer pickup → Processing → Laundromat pickup → Delivery
- **Photo Documentation**: Required proof photos at pickup and delivery with secure storage
- **Real-time Status Updates**: Live order tracking with automated customer notifications
- **Weight Management**: Actual weight capture with automatic payment adjustments
- **Audit Trail**: Complete order timeline with driver accountability

### 🔐 **Unified Role-Based Access Control**
- **Role Hierarchy**: Admin → Driver/Laundromat Staff → Customer with inheritance
- **Secure Authentication**: Server-side validation with Supabase service role
- **Centralized Authorization**: Single `requireRole()` function across all endpoints
- **Future Extensible**: Easy addition of new roles (dispatch, management, etc.)

### 💰 **Comprehensive Pricing & Membership System**
- **Per-Pound Pricing**: $2.25/lb standard, $1.75/lb for members
- **Per-Bag Options**: $35/$55/$85 fixed pricing (members only)
- **6-Month Memberships**: $49.99 with recurring billing via Stripe
- **Centralized Pricing**: Single source of truth for all pricing logic

### 📍 **Advanced Operational Management**
- **Real-time Availability**: Live capacity checking prevents overbooking
- **Service Zone Management**: Geographic coverage with postal code validation
- **Dynamic Scheduling**: Time window management with driver assignments
- **Photo Storage**: Secure Supabase storage with access controls

### 💳 **Enterprise Payment Processing**
- **Stripe Integration**: Full PCI compliance with webhooks
- **Authorization & Capture**: Hold minimum, charge actual weight
- **Subscription Management**: Automatic membership billing
- **Payment Tracking**: Complete transaction audit trail

## 🚛 Driver Workflow System

### Complete Order Process

The driver workflow manages orders through 4 main stages with photo documentation and status validation:

#### 1. **Customer Pickup** 
**Endpoint:** `POST /api/driver/orders/{id}/pickup`

**Driver Actions:**
- Takes photo of laundry bag(s) for documentation
- Records actual weight (if different from estimated)
- Updates order status: `scheduled` → `picked_up`

**System Response:**
- Stores `pickup_photo` in Supabase Storage
- Records `measured_weight_lb` for billing adjustments
- Captures `picked_up_at` timestamp and `driver_id`
- Triggers payment authorization adjustment if weight changed

#### 2. **Processing Complete** 
**Endpoint:** `POST /api/driver/orders/{id}/processing-complete`

**Laundromat Actions:**
- Staff marks order as finished cleaning
- Updates order status: `processing` → `ready_for_delivery`

**System Response:**
- Records `ready_for_delivery_at` timestamp
- Sends customer notification that items are ready
- Makes order available for delivery pickup

#### 3. **Laundromat Pickup**
**Endpoint:** `POST /api/driver/orders/{id}/pickup-laundromat`

**Driver Actions:**
- Collects clean laundry from facility
- Updates order status: `ready_for_delivery` → `en_route_delivery`

**System Response:**
- Records transition timestamp
- Sends customer "out for delivery" notification
- Tracks driver assignment for delivery route

#### 4. **Customer Delivery**
**Endpoint:** `POST /api/driver/orders/{id}/dropoff`

**Driver Actions:**
- Takes photo of delivered items as proof of delivery
- Adds optional delivery notes (e.g., "left at door", "handed to customer")
- Updates order status: `en_route_delivery` → `delivered`

**System Response:**
- Stores `delivery_photo` in Supabase Storage
- Records `delivery_notes` and `delivered_at` timestamp
- Captures final payment for actual weight/services
- Triggers customer delivery confirmation

### Status State Machine

The system enforces valid transitions and prevents invalid status changes:

```typescript
// Valid workflow transitions
{ from: 'scheduled', to: 'en_route_pickup', trigger: 'driver_dispatched' }
{ from: 'en_route_pickup', to: 'picked_up', trigger: 'items_collected', requiresData: ['actual_weight'] }
{ from: 'picked_up', to: 'processing', trigger: 'arrived_at_facility' }
{ from: 'processing', to: 'ready_for_delivery', trigger: 'cleaning_completed' }
{ from: 'ready_for_delivery', to: 'en_route_delivery', trigger: 'out_for_delivery' }
{ from: 'en_route_delivery', to: 'delivered', trigger: 'items_delivered' }
{ from: 'delivered', to: 'completed', trigger: 'payment_finalized' }
```

### Order Lifecycle
```
scheduled → en_route_pickup → picked_up → processing → ready_for_delivery → en_route_delivery → delivered → completed
```

## 🔐 Role-Based Access Control

### Role Hierarchy
```
admin → [driver, laundromat_staff, customer]
driver → [customer]
laundromat_staff → [customer]
customer → []
```

### Usage Examples
```typescript
// Driver workflow endpoints (drivers and admins)
const { user, roles } = await requireRole(cookies, ['driver', 'admin']);

// Laundromat operations (staff and admins)
const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);

// Helper functions for role checking
if (isDriver(roles)) {
  // Driver or admin access
}
if (isLaundromatStaff(roles)) {
  // Laundromat staff or admin access
}
```

### Access Patterns

| Role | Driver Endpoints | Laundromat Endpoints | Admin Endpoints | Member Features |
|------|------------------|---------------------|-----------------|-----------------|
| admin | ✅ (inherited) | ✅ (inherited) | ✅ | ✅ (if has membership) |
| driver | ✅ | ❌ | ❌ | ✅ (if has membership) |
| laundromat_staff | ❌ | ✅ | ❌ | ✅ (if has membership) |
| customer | ❌ | ❌ | ❌ | ✅ (if has membership) |

## 💰 Pricing System

### Per-Pound Pricing
- **Non-Members**: $2.25/lb
- **Members**: $1.75/lb  
- **Savings**: $0.50/lb for members
- **Minimum Order**: $35

### Per-Bag Pricing (Members Only)
- **Small bag**: $35 (up to 20 lbs)
- **Medium bag**: $55 (up to 35 lbs)  
- **Large bag**: $85 (up to 50 lbs)

### Membership Subscription
- **Price**: $49.99 for 6 months
- **Billing**: Automatic via Stripe subscriptions
- **Benefits**: Discounted per-pound pricing + per-bag access

### Payment Integration Flow
```
Order Created → Authorization Hold → Weight Captured → Final Charge
    ($35)           (minimum)        (at pickup)       (at delivery)
```

## 📂 Project Structure

```
/
├── src/
│   ├── components/            # React components
│   │   ├── StripeElements.tsx # Payment processing
│   │   └── ProgressSteps.tsx  # Booking flow UI
│   ├── pages/
│   │   ├── api/               # Backend APIs
│   │   │   ├── auth/          # Authentication routes
│   │   │   ├── driver/        # Driver workflow endpoints
│   │   │   │   └── orders/[id]/         # Order status management
│   │   │   │       ├── pickup.ts        # Customer pickup with photo
│   │   │   │       ├── processing-complete.ts # Laundromat processing done
│   │   │   │       ├── pickup-laundromat.ts  # Pickup from facility
│   │   │   │       └── dropoff.ts       # Customer delivery with photo
│   │   │   ├── create-order.ts          # Order creation
│   │   │   ├── check-availability.ts    # Real-time availability
│   │   │   ├── create-payment-intent.ts # Payment processing
│   │   │   └── stripe-webhook.ts        # Payment confirmations
│   │   ├── orders/[id].astro   # Order tracking page
│   │   ├── checkout.astro      # Payment & membership upsell
│   │   └── membership.astro    # Membership signup
│   ├── utils/
│   │   ├── require-role.ts     # Unified role-based access control
│   │   ├── order-status.ts     # Status state machine & centralized updates
│   │   ├── storage.ts          # Supabase storage for photo uploads
│   │   ├── pricing.ts          # Centralized pricing logic
│   │   └── require-auth.ts     # Base authentication helper
│   └── db/
│       └── schema.ts           # TypeScript database types
├── unified-roles-migration.sql # Database role system setup
└── CLAUDE.md                   # Development guide
```

## 🗄️ Database Schema

### Core Business Tables
- **`orders`** - Main order tracking with status, pricing, photos, driver assignments
- **`customers`** - Customer profiles with auth integration
- **`addresses`** - Customer addresses with geolocation
- **`memberships`** - Stripe subscription tracking

### Operational Tables
- **`service_zones`** - Geographic service areas
- **`time_windows`** - Available pickup/delivery slots
- **`daily_capacity`** - Capacity management per zone/window
- **`drivers`** - Driver profiles and vehicle assignments
- **`admins`** - Administrative user access

### Workflow & Audit
- **`order_status_history`** - Complete audit trail for compliance
- **`user_roles`** (view) - Unified role access across all user types
- **`driver_assignments`** - Route optimization and scheduling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account with database
- Stripe account (test & live keys)
- Mapbox account (for address autocomplete)

### Installation

1. **Clone and Install**
   ```bash
   git clone [repository]
   cd bol-1
   npm install
   ```

2. **Database Setup**
   ```bash
   # Run in Supabase SQL Editor
   # 1. Execute unified-roles-migration.sql
   # 2. Set up RLS policies and storage buckets
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Update with your keys:
   # - PUBLIC_SUPABASE_URL
   # - PUBLIC_SUPABASE_ANON_KEY  
   # - SUPABASE_SERVICE_ROLE_KEY
   # - STRIPE_SECRET_KEY
   # - PUBLIC_STRIPE_PUBLISHABLE_KEY
   # - PUBLIC_MAPBOX_ACCESS_TOKEN
   ```

4. **Sample Data** (for testing)
   ```sql
   -- Add test service zones
   INSERT INTO service_zones (name, description) VALUES
   ('Detroit Core', 'Downtown Detroit and surrounding areas');

   -- Add time windows
   INSERT INTO time_windows (label, start_time, end_time) VALUES
   ('Morning', '08:00', '12:00'),
   ('Afternoon', '12:00', '16:00'),
   ('Evening', '16:00', '20:00');

   -- Add daily capacity
   INSERT INTO daily_capacity (service_date, zone_id, time_window_id, pickup_capacity, delivery_capacity)
   SELECT CURRENT_DATE, sz.id, tw.id, 10, 10
   FROM service_zones sz, time_windows tw;
   ```

5. **Start Development**
   ```bash
   npm run dev
   # Visit http://localhost:4323

   ```

## 🧪 Testing the System

### Driver Workflow Test
1. Create test accounts in `drivers` and `admins` tables
2. Place a test order through the booking flow
3. Use driver endpoints to move order through workflow:
   - `POST /api/driver/orders/{id}/pickup` (with photo)
   - `POST /api/driver/orders/{id}/processing-complete`
   - `POST /api/driver/orders/{id}/pickup-laundromat`
   - `POST /api/driver/orders/{id}/dropoff` (with photo)

### Role System Test
```bash
# Test driver can access driver endpoints but not admin endpoints
# Test admin can access all endpoints
# Test proper error responses for unauthorized access
```

### Payment Testing
- Use Stripe test cards: `4242424242424242`
- Test membership signup and billing
- Verify webhook handling in Stripe dashboard

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## 🔐 Security Features

### Authentication & Authorization
- **Unified Role System**: Centralized access control with hierarchy
- **Server-Side Validation**: All role checks use service role client
- **Photo Security**: Supabase storage with proper access controls
- **Session Management**: Secure cookie-based authentication

### Data Protection
- **Audit Trails**: Complete order and status change history
- **Payment Security**: PCI-compliant Stripe integration
- **Environment Isolation**: Separate test/production configurations
- **Row Level Security**: Database-level access controls

## 🌟 Key Architectural Decisions

### ✅ **Unified Role System**
- Single `requireRole()` function replaces multiple auth helpers
- Role hierarchy with admin inheritance across all functions
- Database view for efficient role querying with RLS protection
- Future-extensible for new organizational roles

### ✅ **Centralized Pricing Logic**
- All pricing constants in `src/utils/pricing.ts`
- Membership subscription, per-pound, and per-bag pricing unified
- Automatic calculations with proper TypeScript types
- Easy price updates across entire application

### ✅ **Complete Driver Workflow**
- 4-stage process with photo documentation and audit trails
- Status state machine prevents invalid transitions
- Real-time customer notifications and driver accountability
- Production-ready with error handling and validation

### ✅ **Real-Time Operations**
- Live capacity management prevents overbooking
- Dynamic availability checking with geographic validation
- Automated weight adjustments and payment processing
- Complete order lifecycle management

## 🚀 Production Deployment

### Database Configuration
1. Run `unified-roles-migration.sql` for role system
2. Set up Supabase storage buckets for photos
3. Configure RLS policies for data security
4. Set up daily capacity for service areas

### Payment System
1. Configure Stripe webhook endpoints
2. Test subscription billing and webhooks
3. Set up proper error handling and monitoring
4. Enable production payment processing

### Operational Setup
1. Create admin and driver accounts
2. Configure service zones and time windows
3. Set up daily capacity management
4. Train staff on driver workflow system

## 📈 Business Impact

### Operational Efficiency
- **No Overbooking**: Real-time capacity prevents scheduling conflicts
- **Complete Accountability**: Photo documentation and audit trails
- **Automated Workflows**: Status transitions with customer notifications
- **Role-Based Security**: Proper access controls for all staff levels

### Revenue Optimization
- **Membership Growth**: $49.99 subscription with recurring billing
- **Dynamic Pricing**: Per-pound and per-bag options maximize revenue
- **Weight Accuracy**: Actual weight capture ensures fair pricing
- **Payment Security**: Reduced disputes with photo documentation

## 📝 Documentation

- **`CLAUDE.md`** - Complete development guide and architecture notes
- **`unified-roles-migration.sql`** - Database setup for role system
- **`laundromat-role-examples.md`** - Role system usage examples

## 📞 Support & Development

This platform is built for production laundry operations with enterprise-grade security, scalability, and operational management. The codebase follows modern TypeScript patterns with comprehensive error handling and audit trails.

For technical questions, refer to the documentation files and inline code comments throughout the application.

---

**Built for modern laundry operations with enterprise-grade scalability and complete operational control.** 🧺✨