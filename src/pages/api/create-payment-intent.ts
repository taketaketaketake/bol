import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      amount,
      currency = 'usd',
      addMembership = false,
      orderDetails
    } = body;

    // Validate amount
    if (!amount || amount < 50) { // Minimum $0.50
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (addMembership) {
      // For membership orders, we need to create a customer first, then handle both the order and subscription
      const customerEmail = orderDetails?.customerEmail;
      if (!customerEmail) {
        return new Response(
          JSON.stringify({ error: 'Customer email required for membership signup' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if customer already exists
      let customer;
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: customerEmail,
          name: orderDetails?.customerName || '',
          metadata: {
            source: 'laundry_service_membership',
          },
        });
      }

      // Create membership subscription (6-month $49.99)
      const membershipPrice = await stripe.prices.create({
        unit_amount: 4999, // $49.99 in cents
        currency: 'usd',
        recurring: { interval: 'month', interval_count: 6 },
        product_data: {
          name: 'Bags of Laundry 6-Month Membership',
          description: '6-month membership with discounted per-pound pricing and priority booking',
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: membershipPrice.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          membershipType: 'annual',
          signupOrderAmount: amount.toString(),
          orderType: orderDetails?.orderType || 'unknown',
        },
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      // Apply member pricing to the current order (save $0.50/lb)
      let discountedOrderAmount = amount;
      if (orderDetails?.orderType === 'per_pound') {
        // Assume 20lb order, apply $0.50/lb discount = $10 savings
        discountedOrderAmount = Math.max(amount - 1000, 0); // Don't go below $0
      } else {
        // Apply $10 discount to fixed-price orders
        discountedOrderAmount = Math.max(amount - 1000, 0);
      }

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          amount: 4999, // Membership subscription amount ($49.99)
          orderAmount: discountedOrderAmount, // Discounted order amount (processed separately)
          membershipIncluded: true,
          customerId: customer.id,
          subscriptionId: subscription.id,
          savings: amount - discountedOrderAmount,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Regular order without membership
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency,
        metadata: {
          orderType: orderDetails?.orderType || 'unknown',
          addMembership: 'false',
          customerEmail: orderDetails?.customerEmail || '',
          pickupAddress: orderDetails?.pickupAddress || '',
          pickupDate: orderDetails?.pickupDate || '',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          amount: amount,
          membershipIncluded: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error) {
    console.error('Error creating payment intent:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};