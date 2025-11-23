# Bags of Laundry

A modern laundry service platform built with Astro, React, and TypeScript, featuring automatic laundromat routing and capacity management.

## Features

- **Automatic Order Routing** - Orders automatically assigned to partner laundromats based on ZIP code
- **Real-time Capacity Management** - Dynamic load balancing across laundromat partners
- **Stripe Integration** - Payments, subscriptions, and partner payouts via Stripe Connect
- **Guest & Member Orders** - Support for both guest checkout and membership pricing
- **Admin Dashboard** - Order management and partner coordination tools

## ZIP Code Coverage Mapping System

The platform uses an intelligent routing system that automatically assigns orders to the best available laundromat partner based on the customer's ZIP code.

### How It Works

1. **Customer places order** with pickup ZIP code (e.g., 48201)
2. **System finds available laundromats** serving that ZIP code using the `laundromat_service_areas` table
3. **Filters by capacity** - only includes laundromats with available daily capacity
4. **Auto-assigns to least busy** laundromat for optimal load balancing
5. **Updates capacity counters** in real-time

### Coverage Example

```
Downtown Express Wash (48226)
├── Serves: 48201 (Midtown Detroit)
├── Serves: 48226 (Downtown Detroit) 
└── Serves: 48243 (Riverfront)

Midtown Wash & Fold (48201)
├── Serves: 48201 (Midtown Detroit)
├── Serves: 48202 (New Center)
└── Serves: 48226 (Downtown Detroit)
```

**Overlapping Coverage**: ZIP codes like 48201 and 48226 are served by multiple laundromats, providing redundancy and automatic failover when one partner reaches capacity.

### Database Structure

```sql
-- Many-to-many relationship for service coverage
CREATE TABLE laundromat_service_areas (
  id UUID PRIMARY KEY,
  laundromat_id UUID REFERENCES laundromats(id),
  zip_code TEXT NOT NULL,
  UNIQUE(laundromat_id, zip_code)
);

-- Laundromats with capacity management
CREATE TABLE laundromats (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  max_daily_orders INTEGER DEFAULT 50,    -- Maximum daily capacity
  today_orders INTEGER DEFAULT 0,         -- Current daily count
  is_active BOOLEAN DEFAULT true,
  -- ... other fields
);
```

### Routing Function

```sql
-- Find available laundromats by ZIP code (ordered by capacity)
SELECT * FROM find_laundromat_by_zip('48201');
```

Returns laundromats sorted by current load (least busy first), enabling automatic load balancing.

## Tech Stack

- **Framework**: Astro 5.7+ with SSR
- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL via Supabase with Row Level Security
- **Payments**: Stripe with Connect for partner payouts
- **Deployment**: Netlify with serverless functions

## Project Structure

```
src/
├── components/          # React components
├── pages/               # Astro pages and API routes
│   └── api/            # Backend API endpoints
├── db/                 # Database schema and types
├── utils/              # Shared utilities
├── emails/             # Email templates
└── styles/             # Global styles

sql/                    # Database migrations and functions
docs/                   # Documentation
```

## Key API Endpoints

- `POST /api/create-order` - Creates orders with automatic laundromat assignment
- `POST /api/assign-laundromat` - Manual/automated laundromat assignment
- `POST /api/capture-payment` - Captures payment after weight measurement
- `POST /api/stripe-webhook` - Handles Stripe events

## Database Features

- **Automatic Routing** - ZIP-based laundromat assignment
- **Capacity Management** - Real-time load balancing
- **Order Lifecycle** - Complete status tracking from scheduled to delivered
- **Payment Integration** - Stripe PaymentIntents with hold/capture flow
- **Guest Authentication** - Secure ordertracking without account creation
- **Membership Pricing** - Subscription-based discounted rates

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run database migrations
psql "$DATABASE_URL" -f sql/laundromat-routing-infrastructure-reset.sql
```

## Environment Variables

Required environment variables (see `.env.example`):

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `MAPBOX_ACCESS_TOKEN` - For address autocomplete

## Capacity Management

The system includes comprehensive capacity management tools:

- **Daily order limits** per laundromat partner
- **Real-time utilization tracking** 
- **Automatic counter resets** (via cron)
- **Load balancing** across partners
- **Geographic coverage** optimization

See [CAPACITY-MANAGEMENT.md](docs/CAPACITY-MANAGEMENT.md) for detailed documentation.

## Migration from Zone-Based System

This platform has migrated from a zone-based capacity system to a modern laundromat-centric approach, providing:

- ✅ **Automatic load balancing** instead of manual capacity planning
- ✅ **Real-time capacity tracking** instead of pre-allocated slots
- ✅ **Partner-focused routing** for better business relationships  
- ✅ **Simplified operations** - no daily capacity setup required
- ✅ **Better scalability** - easy to add new partners and service areas

## License

Private - Bags of Laundry Platform