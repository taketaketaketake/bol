import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const origin = new URL(request.url).origin;

    // Check if customer already exists
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          source: 'membership_signup',
        },
      });
    }

    // Create Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Bags of Laundry 6-Month Membership',
              description: 'Save $0.50/lb on every order + unlock per-bag pricing options',
            },
            recurring: {
              interval: 'month',
              interval_count: 6,
            },
            unit_amount: 4999, // $49.99
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          membershipType: '6_month',
          source: 'direct_signup',
        },
      },
      success_url: `${origin}/api/verify-membership-payment?session_id={CHECKOUT_SESSION_ID}&redirect=/order-type`,
      cancel_url: `${origin}/membership?canceled=true`,
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error creating membership checkout session:', error);

    // Log detailed error info
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to create membership checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
