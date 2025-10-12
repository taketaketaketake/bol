# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start Astro development server (localhost:4323)
npm run build        # Build for production
npm run preview      # Preview production build

# Database Management
npx drizzle-kit generate   # Generate new migration files
npx drizzle-kit migrate    # Run pending migrations
npx drizzle-kit push       # Push schema changes directly to database
npx drizzle-kit studio     # Open Drizzle Studio for database inspection
```

## Project Architecture

### Technology Stack
- **Framework**: Astro 5.7+ with server-side rendering
- **Frontend**: React components with TypeScript
- **Styling**: Tailwind CSS with custom brand colors
- **Database**: PostgreSQL via Supabase with Drizzle ORM
- **Payments**: Stripe with subscription support
- **Deployment**: Netlify with server functions

### Core Architecture Patterns

**Guest Authentication System**: Orders can be created without account registration using secure access tokens. Guest orders use email + phone verification and generate 14-day access tokens for order tracking.

**Service Area Management**: Geographic zones defined by postal codes with capacity management per zone and time window. All booking availability is checked against `daily_capacity` table.

**Payment Flow**: Authorization hold at booking → weight measurement at pickup → capture actual amount. Supports membership pricing and subscription billing.

**Order Lifecycle**: `scheduled → en_route_pickup → picked_up → processing → ready_for_delivery → delivered → completed`

### Database Schema Key Points

**Orders Table**: Central table with foreign keys to customers, addresses, service zones, and time windows. Includes access tokens for guest orders and Stripe payment tracking.

**Capacity Management**: `daily_capacity` table tracks available pickup/delivery slots per zone and time window. Used by `get_available_windows()` SQL function for real-time availability checking.

**Memberships**: Stripe subscription integration with customer pricing tiers. Active memberships change per-pound pricing from $2.49 to $1.99.

### API Patterns

**Availability Checking**: `/api/check-availability.ts` calls `get_available_windows()` SQL function for real-time slot availability based on postal code → service zone mapping.

**Order Creation**: `/api/create-order.ts` handles guest order creation with token generation and email notifications via Supabase functions.

**Payment Processing**: 
- `/api/create-payment-intent.ts` - Initial authorization hold
- `/api/capture-payment.ts` - Final charge after weight measurement
- `/api/stripe-webhook.ts` - Payment confirmations and subscription updates

### Key File Locations

**Database**: 
- Schema: `src/db/schema.ts`
- Migrations: `database-migrations.sql`
- Functions: `sql-functions.sql`

**Core APIs**: `src/pages/api/` contains all backend endpoints
**Components**: `src/components/` - React components for booking flow and payment
**Utils**: `src/utils/` - Authentication, order status, and helper functions

### Important Implementation Notes

**Environment Variables**: Requires Supabase URL/keys, Stripe keys (test/live), and Mapbox token for address autocomplete.

**RLS Policies**: Database uses Row Level Security for multi-tenant access control. Guest orders bypass RLS through application-level token validation.

**Stripe Integration**: Supports both one-time payments and subscription billing. Webhook verification required for production security.

**Testing**: Use Stripe test cards (4242424242424242) and Detroit postal codes (48201-48226) for booking flow testing.