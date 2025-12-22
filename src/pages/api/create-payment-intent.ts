import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { MEMBERSHIP_SUBSCRIPTION_CENTS, MEMBERSHIP_PLAN, MEMBERSHIP_DURATION_MONTHS, MembershipTier, getPerPoundRate, MEMBERSHIP_TIERS, getUserTier } from '../../utils/pricing';
import { getConfig } from '../../utils/env';
import { rateLimit, RATE_LIMITS } from '../../utils/rate-limit';

// Get validated configuration
const config = getConfig();

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request }) => {
  // Apply payment rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.PAYMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    console.log('[create-payment-intent] Received request:', JSON.stringify(body, null, 2));

    const {
      amount,
      currency = 'usd',
      addMembership = false,
      orderDetails
    } = body;

    // Validate amount
    if (!amount || amount < 50) { // Minimum $0.50
      console.error('[create-payment-intent] Invalid amount:', amount);
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

      // Create membership subscription
      const membershipPrice = await stripe.prices.create({
        unit_amount: MEMBERSHIP_SUBSCRIPTION_CENTS,
        currency: 'usd',
        recurring: { interval: 'month', interval_count: MEMBERSHIP_DURATION_MONTHS },
        product_data: {
          name: MEMBERSHIP_PLAN.name,
          description: MEMBERSHIP_PLAN.description,
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: membershipPrice.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          membership_tier: MembershipTier.MEMBER,
          tier_label: MEMBERSHIP_TIERS[MembershipTier.MEMBER].label,
          membership_plan: MEMBERSHIP_PLAN.name,
          duration_months: MEMBERSHIP_DURATION_MONTHS.toString(),
          price_per_pound: getPerPoundRate(MembershipTier.MEMBER).toString(),
          membership_status: 'signup_in_progress',
          order_type: 'membership_signup',
          customer_id: customer.id,
          signup_order_amount: amount.toString(),
          legacy_membership_type: 'annual', // Keep for backwards compatibility
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
          amount: MEMBERSHIP_SUBSCRIPTION_CENTS, // Membership subscription amount
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
      // Determine tier for this order (assumes non-member for regular orders)
      const tier = MembershipTier.NON_MEMBER;
      const isMember = false;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency,
        metadata: {
          membership_tier: tier,
          tier_label: MEMBERSHIP_TIERS[tier].label,
          membership_plan: null, // Not applicable for laundry orders
          duration_months: null, // Not applicable for laundry orders
          price_per_pound: getPerPoundRate(tier).toString(),
          membership_status: isMember ? 'active' : 'none',
          order_type: 'laundry',
          customer_id: orderDetails?.customerId || 'guest',
          // Legacy fields for backwards compatibility
          orderType: orderDetails?.orderType || 'unknown',
          addMembership: 'false',
          customerEmail: orderDetails?.customerEmail || '',
          pickupAddress: typeof orderDetails?.pickupAddress === 'string'
            ? orderDetails.pickupAddress
            : orderDetails?.pickupAddress?.line1 || '',
          pickupDate: orderDetails?.pickupDate || '',
          orderId: orderDetails?.orderId || '',
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
    console.error('[create-payment-intent] Error:', error);
    console.error('[create-payment-intent] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return new Response(
      JSON.stringify({
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};