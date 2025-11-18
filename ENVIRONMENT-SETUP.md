# Environment Configuration Guide

This document explains how to set up environment variables for the Bags of Laundry application.

## Quick Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env` (never commit this file!)

3. For production deployment, configure environment variables in your hosting platform (Netlify, Vercel, etc.)

## Required Environment Variables

### Supabase (Database & Auth)
- **PUBLIC_SUPABASE_URL**: Your Supabase project URL
- **PUBLIC_SUPABASE_ANON_KEY**: Supabase anonymous/public key  
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase service role key (server-side operations)
- **DATABASE_URL**: PostgreSQL connection string

**Setup Instructions:**
1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > API to find your keys
3. Go to Settings > Database to find connection string

### Stripe (Payments)
- **STRIPE_SECRET_KEY**: Stripe secret key (`sk_test_...` for development, `sk_live_...` for production)
- **PUBLIC_STRIPE_PUBLISHABLE_KEY**: Stripe publishable key (`pk_test_...` for development, `pk_live_...` for production)  
- **STRIPE_WEBHOOK_SECRET**: Webhook endpoint secret for signature verification

**Setup Instructions:**
1. Create account at [stripe.com](https://stripe.com)
2. Get test keys from Dashboard > Developers > API keys
3. Set up webhook endpoint for payment events
4. Use test keys for development, live keys for production

### Mapbox (Address Autocomplete)
- **MAPBOX_ACCESS_TOKEN**: Mapbox access token
- **PUBLIC_MAPBOX_ACCESS_TOKEN**: Same token (needed for client-side)

**Setup Instructions:**
1. Create account at [mapbox.com](https://mapbox.com)
2. Go to Account > Access tokens
3. Create or use default public token

### Email Service (Resend)
- **RESEND_API_KEY**: Resend API key for sending emails
- **RESEND_FROM_EMAIL**: Verified sender email address
- **YOUR_NOTIFICATION_EMAIL**: Email to receive admin notifications

**Setup Instructions:**
1. Create account at [resend.com](https://resend.com)
2. Verify your domain or use Resend's domain
3. Create API key in dashboard

### Application
- **PUBLIC_SITE_URL**: Your application's URL (`http://localhost:4321` for dev, `https://yourdomain.com` for prod)
- **NODE_ENV**: Environment (`development` or `production`)

### Optional: SMS Service (Telnyx)
- **TELNYX_API_KEY**: Telnyx API key for SMS functionality
- **TELNYX_WEBHOOK_SECRET**: Webhook secret for SMS events

## Security Best Practices

### Development
- Use test/sandbox keys for all services
- Keep `.env` file local and never commit to git
- Use different keys for each environment (dev/staging/prod)

### Production
- Store all secrets in your hosting platform's environment variables
- Use live/production keys for all services  
- Enable webhook signature verification
- Regularly rotate sensitive keys

## Netlify Deployment

1. Go to your Netlify dashboard
2. Site settings > Environment variables
3. Add all required variables from `.env.example`
4. Use production values (live Stripe keys, production Supabase, etc.)

## Common Issues

**Build failures**: Ensure all PUBLIC_ variables are properly set for client-side access

**Database connection errors**: Check DATABASE_URL format and network access

**Payment errors**: Verify Stripe keys match the environment (test vs live)

**Email sending fails**: Confirm domain verification in Resend

## Environment Validation

The app includes automatic validation of required environment variables on startup. Missing or invalid variables will cause helpful error messages.

See `src/utils/env.ts` for the validation logic and to add new required variables.