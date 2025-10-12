# Bags of Laundry - Professional Laundry Service Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Astro](https://img.shields.io/badge/Astro-5.14.1-FF5D01?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Latest-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Latest-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-181818?logo=supabase&logoColor=white)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Latest-008CDD?logo=stripe&logoColor=white)](https://stripe.com/)

A modern, comprehensive laundry service platform built with Astro, featuring unified authentication, real-time availability checking, Stripe payment integration, and advanced capacity management for pickup and delivery operations.

## ✨ Core Features

### 🚀 **Modern Booking Experience**
- **Smart Availability Checking** - Real-time capacity management with service area validation
- **Unified Authentication** - Secure cookie-based authentication with Supabase Auth
- **Dynamic Time Windows** - Live capacity display with overbooking prevention
- **Progressive Web Experience** - Mobile-first booking flow

### 💳 **Complete Payment System**
- **Stripe Integration** - Secure card processing with PCI compliance
- **Membership Subscriptions** - Annual membership with automatic billing
- **Authorization & Capture** - Hold minimum amount, capture actual weight pricing
- **Webhook Security** - Verified payment confirmations and status updates

### 📍 **Operational Management**
- **Service Zone Management** - Geographic service areas with postal code validation
- **Capacity Planning** - Daily capacity management per zone and time window
- **Order Tracking** - Complete status machine from pickup to delivery
- **Driver Assignment** - Route optimization and capacity allocation

### 🔍 **Enterprise SEO**
- **Technical SEO** - Complete meta tags, structured data, sitemaps
- **Local Business Schema** - Rich snippets for Google Business listings
- **Social Media Ready** - Open Graph and Twitter Card integration
- **Performance Optimized** - Fast loading with Core Web Vitals optimization

## 🎯 Business Model

### Service Offerings
- **Per-Pound Pricing**: $2.49/lb with $35 minimum order
- **Membership Program**: $99/year for $1.99/lb pricing + perks
- **Add-On Services**: Rush delivery, eco-friendly options, hang-dry delicates
- **Specialty Items**: Comforters, bedding bundles, dry cleaning

### Geographic Coverage
- **Primary Market**: Detroit Metro Area
- **Service Zones**: Expandable postal code-based service areas
- **Delivery Model**: Free pickup & delivery within service zones

## 🏗️ Architecture

### Authentication Architecture
```
Login/Signup → Cookie-Based Session → Authenticated API Access
```
- **Unified Auth**: All API routes use consistent `requireAuth()` helper
- **Cookie-Based Sessions**: Secure session management via HTTP-only cookies
- **Server-Optimized**: Custom Supabase client configuration for API routes
- **Type-Safe**: Strong typing with `AuthResult` interface

### Payment Processing
```
Booking: $35 Authorization Hold → Pickup: Weight Captured → Final: Actual Charge
```
- **Authorization**: Minimum hold at booking
- **Capture**: Actual amount after weight measurement
- **Subscriptions**: Automatic membership billing

### Order Lifecycle
```
scheduled → en_route_pickup → picked_up → processing → ready_for_delivery → delivered → completed
```

## 📂 Project Structure

```
/
├── public/                     # Static assets
├── src/
│   ├── components/            # Shared components
│   │   ├── StripeElements.tsx # Payment processing
│   │   └── ProgressSteps/     # Booking flow UI
│   ├── layout/
│   │   └── Layout.astro       # SEO-optimized layout
│   ├── pages/
│   │   ├── api/               # Backend APIs
│   │   │   ├── auth/                    # Authentication routes
│   │   │   ├── create-order.ts          # Authenticated order creation
│   │   │   ├── check-availability.ts    # Real-time availability
│   │   │   ├── create-payment-intent.ts # Payment processing
│   │   │   ├── capture-payment.ts       # Post-weight capture
│   │   │   └── stripe-webhook.ts        # Payment confirmations
│   │   ├── orders/
│   │   │   └── [id].astro     # Authenticated order view
│   │   ├── start-basic.astro  # Enhanced booking entry
│   │   ├── checkout.astro     # Payment & membership upsell
│   │   └── confirm.astro      # Order confirmation
│   ├── lib/
│   │   ├── supabase.ts        # Client-side Supabase config
│   │   └── supabase-server.ts # Server-optimized Supabase config
│   └── utils/
│       ├── require-auth.ts    # Unified authentication helper
│       ├── order-status.ts    # Status machine
│       └── wizard.server.ts   # Booking flow state
├── database-migrations.sql     # Database schema updates
├── sql-functions.sql          # Availability & capacity functions
├── CLAUDE.md                  # Claude Code development guide
└── .env                       # Environment configuration
```

## 🗄️ Database Schema

### Core Tables
- **`customers`** - Customer information with auth integration
- **`orders`** - Main order tracking with pricing, status, Stripe integration
- **`addresses`** - Customer addresses with geolocation
- **`memberships`** - Subscription tracking for Stripe integration

### Operational Tables
- **`service_zones`** - Geographic service areas with postal codes
- **`time_windows`** - Available pickup/delivery time slots
- **`daily_capacity`** - Daily capacity management per zone/window
- **`drivers`** - Driver management and assignments

### Content & Management
- **`articles`** - Content management system
- **`notifications`** - Communication tracking
- **`tasks`** - Internal task management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Stripe account
- Mapbox account (for address autocomplete)

### Installation

1. **Clone and Install**
   ```bash
   git clone [repository]
   cd bol-new-new
   npm install
   ```

2. **Database Setup**
   ```sql
   -- Run in Supabase SQL Editor
   -- 1. Execute database-migrations.sql
   -- 2. Execute sql-functions.sql
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Update with your actual API keys:
   # - Supabase URL and keys
   # - Stripe API keys (test/live)
   # - Mapbox access token
   ```

4. **Sample Data** (for testing)
   ```sql
   -- Add sample service zones
   INSERT INTO service_zones (name, postal_codes, base_min_order_cents) VALUES
   ('Detroit Core', ARRAY['48201', '48202', '48226', '48207'], 3500);

   -- Add sample time windows
   INSERT INTO time_windows (label, start_time, end_time, is_active) VALUES
   ('Morning', '08:00', '12:00', true),
   ('Afternoon', '12:00', '16:00', true),
   ('Evening', '16:00', '20:00', true);

   -- Add today's capacity
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

### Booking Flow Test
1. Navigate to `/start-basic`
2. Enter Detroit address: "123 Main St, Detroit, MI 48201"
3. Select today's date
4. Watch real-time availability checking
5. Select available time window
6. Complete booking flow through checkout

### Payment Testing
- Use Stripe test cards: `4242424242424242`
- Test membership signup during checkout
- Verify webhook handling in Stripe dashboard

## 🔧 Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript checking |

## 🔐 Authentication System

### **Unified Authentication Helper**
The application uses a centralized `requireAuth()` helper function for all protected API routes:

```typescript
// src/utils/require-auth.ts
import { requireAuth, createAuthErrorResponse } from '../../utils/require-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user and get Supabase client
    const { user, supabase } = await requireAuth(cookies);
    
    // Your route logic here...
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    // Handle other errors...
  }
};
```

### **Protected Routes**
The following API routes require authentication:
- **Order Management**: `create-order.ts`, `orders/cancel.ts`
- **Payment Processing**: `create-membership-payment-intent.ts`
- **Profile Management**: `profile/update.ts`
- **Content Management**: `articles.ts`, `articles/[id].ts`
- **Authentication**: `auth/reset-password.ts`

### **Public Routes**
These routes are intentionally public:
- **Availability Checking**: `check-availability.ts`
- **Payment Processing**: `authorize-payment.ts`, `create-payment-intent.ts`
- **Webhooks**: `stripe-webhook.ts` (uses Stripe signature verification)
- **Authentication**: All `/auth/*` routes handle their own verification

### **Security Features**
- **Server-Optimized Supabase Config**: Disabled auto-refresh and session persistence for API routes
- **Consistent Error Handling**: Standardized 401 responses across all routes
- **Type Safety**: `AuthResult` interface provides strong typing for user data
- **Cookie-Based Sessions**: Secure session management using HTTP-only cookies

## 🌟 Key Implementation Highlights

### ✅ **SEO Implementation Complete**
- **Technical Foundation**: Comprehensive meta tags, structured data, sitemaps
- **Local Business Schema**: Rich snippets for Google Business listings
- **Social Media Ready**: Open Graph and Twitter Card integration
- **Performance Optimized**: Fast loading with enterprise-level SEO

### ✅ **Unified Authentication System**
- **Centralized Auth Helper**: `requireAuth()` function used across all protected routes
- **Cookie-Based Sessions**: Secure session management with HTTP-only cookies
- **Server-Optimized**: Custom Supabase client configuration for better performance
- **Type-Safe**: Strong typing with `AuthResult` interface and consistent error handling

### ✅ **Real-Time Availability Management**
- **Service Area Validation**: Postal code-based zone verification
- **Capacity Management**: Live slot availability with overbooking prevention
- **Dynamic Time Windows**: Real-time display of available pickup times
- **Smart Form Enhancement**: Progressive disclosure based on availability

### ✅ **Complete Stripe Integration**
- **Secure Payments**: Full PCI-compliant card processing
- **Membership Subscriptions**: Annual billing with automatic renewals
- **Authorization Flow**: Hold minimum, capture actual weight pricing
- **Webhook Security**: Verified payment confirmations and status updates

### ✅ **Membership Upsell System**
- **Strategic Placement**: Optimally positioned during checkout flow
- **Value Communication**: Clear savings display and member benefits
- **One-Click Addition**: Seamless membership signup experience
- **Dynamic Pricing**: Real-time total calculations with member discounts

## 🚀 Production Deployment

### Database Setup
1. Run `database-migrations.sql` in Supabase
2. Execute `sql-functions.sql` for availability checking
3. Populate service zones and time windows
4. Set up daily capacity for initial markets

### API Configuration
1. Replace Stripe test keys with live keys
2. Configure Stripe webhook endpoints
3. Set up proper domain in environment variables
4. Enable Mapbox geocoding for address validation

### Monitoring & Analytics
1. Set up Google Search Console
2. Configure Google Analytics
3. Monitor Core Web Vitals
4. Track conversion rates and operational metrics

## 📈 Business Impact

### Operational Efficiency
- **No Overbooking**: Real-time capacity prevents scheduling conflicts
- **Automated Validation**: Service area checking reduces manual work
- **Smart Routing**: Zone-based assignments optimize driver routes

### Revenue Growth
- **Membership Conversion**: Upsell at point of purchase increases AOV
- **Retention**: Members show higher lifetime value and reorder rates
- **Scalability**: Zone-based expansion model supports geographic growth

### Customer Experience
- **Frictionless Booking**: No signup required for first orders
- **Transparent Pricing**: Clear capacity and availability information
- **Professional Communication**: Automated notifications and confirmations

## 📝 Documentation

- **`GUEST-AUTH-IMPLEMENTATION.md`** - Complete authentication system guide
- **`database-migrations.sql`** - Schema updates and new tables
- **`sql-functions.sql`** - Availability checking and capacity management
- **Implementation Notes** - Detailed session notes and feature documentation

## 🔒 Security & Compliance

- **PCI Compliance**: Stripe handles all sensitive card data
- **Token Security**: Crypto-secure guest access tokens
- **Webhook Verification**: Stripe signature verification
- **Data Protection**: Secure handling of customer information

## 📞 Support & Contact

For questions about implementation or deployment:
- Review documentation in project files
- Check Stripe dashboard for payment issues
- Verify Supabase configuration for database connectivity
- Test availability system with sample data

---

**Built for modern laundry operations with enterprise-grade scalability and security.** 🧺✨