import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { rateLimit, RATE_LIMITS } from '../../utils/rate-limit';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  // Apply payment rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.PAYMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const {
      orderId,
      customerEmail,
      authorizeAmount = 3500, // $35 minimum hold in cents
      addMembership = false,
      membershipAmount = 9900 // $99 in cents
    } = body;

    // Calculate authorization amount
    let totalAuthAmount = authorizeAmount;
    if (addMembership) {
      totalAuthAmount += membershipAmount;
    }

    // Create payment intent with capture_method: manual for authorization
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAuthAmount,
      currency: 'usd',
      capture_method: 'manual', // This creates an authorization hold
      metadata: {
        orderId: orderId,
        customerEmail: customerEmail,
        authorizationType: 'minimum_hold',
        addMembership: addMembership.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        authorizedAmount: totalAuthAmount,
        paymentIntentId: paymentIntent.id,
        status: 'authorized'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating payment authorization:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to authorize payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};