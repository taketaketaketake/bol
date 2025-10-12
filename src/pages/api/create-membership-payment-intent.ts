import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { requireAuth, createAuthErrorResponse } from '../../utils/require-auth';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user and get Supabase client
    const { user, supabase } = await requireAuth(cookies);

    const { email } = await request.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Customer record not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ CHECK FOR EXISTING ACTIVE MEMBERSHIP
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('memberships')
      .select('id, status, start_date, end_date')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (membershipCheckError) {
      console.error('[create-membership-payment-intent] Error checking membership:', membershipCheckError);
    }

    if (existingMembership) {
      console.log('[create-membership-payment-intent] User already has active membership');
      return new Response(
        JSON.stringify({
          error: 'You already have an active membership',
          existingMembership: true
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find or create Stripe customer
    let stripeCustomer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
    } else {
      stripeCustomer = await stripe.customers.create({
        email: email,
        metadata: {
          supabase_customer_id: customer.id,
          auth_user_id: user.id
        },
      });
    }

    // Create Stripe Checkout Session for membership
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bags of Laundry - 6 Month Membership',
              description: 'Save $0.50/lb + unlock per-bag pricing',
            },
            unit_amount: 4999, // $49.99
            recurring: {
              interval: 'month',
              interval_count: 6,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${new URL(request.url).origin}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(request.url).origin}/membership?canceled=true`,
      metadata: {
        customer_id: customer.id,
        auth_user_id: user.id,
      },
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[create-membership-payment-intent] Error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const prerender = false;
