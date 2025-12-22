import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../../utils/env';
import { rateLimit, RATE_LIMITS } from '../../utils/rate-limit';

// Get validated configuration
const config = getConfig();

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = config.stripeWebhookSecret;

// Create Supabase admin client for webhooks (bypasses RLS)
const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Validate configuration on startup
console.log('[Webhook] Supabase URL configured:', !!config.supabaseUrl);
console.log('[Webhook] Service role key configured:', !!config.supabaseServiceRoleKey);
console.log('[Webhook] Stripe webhook secret configured:', !!endpointSecret);

export const POST: APIRoute = async ({ request }) => {
  // Apply lenient webhook rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.WEBHOOK);
  if (rateLimitResponse) return rateLimitResponse;

  console.log('[Webhook] ========== NEW WEBHOOK REQUEST ==========');
  console.log('[Webhook] Time:', new Date().toISOString());

  const sig = request.headers.get('stripe-signature');

  if (!sig || !endpointSecret) {
    console.error('[Webhook] Missing stripe signature or webhook secret');
    console.error('[Webhook] Has signature:', !!sig);
    console.error('[Webhook] Has endpoint secret:', !!endpointSecret);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    console.log('[Webhook] Body length:', body.length);
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    console.log('[Webhook] ✅ Signature verified successfully');
    console.log('[Webhook] Event type:', event.type);
    console.log('[Webhook] Event ID:', event.id);
  } catch (err) {
    console.error('[Webhook] ❌ Signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(failedPayment);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        await handleSubscriptionPayment(invoice);
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(updatedSubscription);
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSubscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('Webhook handled successfully', { status: 200 });

  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
};

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Webhook] Payment succeeded:', paymentIntent.id);

  try {
    // Update order payment status in database
    const { data: order, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        stripe_charge_id: paymentIntent.latest_charge as string || null,
        paid_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .select('id, customer_id')
      .single();

    if (updateError) {
      console.error('[Webhook] Failed to update order payment status:', updateError);
      throw updateError;
    }

    console.log(`[Webhook] Order ${order?.id} marked as paid`);

    // Log metadata for debugging (order was already created by /api/create-order.ts)
    const metadata = paymentIntent.metadata;
    console.log('[Webhook] Payment metadata:', {
      amount: paymentIntent.amount / 100,
      order_id: metadata.order_id,
      customer_id: metadata.customer_id,
      pricing_model: metadata.pricing_model
    });

  } catch (error) {
    console.error('[Webhook] Error in handlePaymentSuccess:', error);
    // Don't throw - we don't want to fail the webhook if DB update fails
    // The payment succeeded in Stripe, which is the source of truth
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Webhook] Payment failed:', paymentIntent.id);

  try {
    // Update order payment status to failed
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('[Webhook] Failed to update order payment failure status:', updateError);
    } else {
      console.log('[Webhook] Order marked as payment failed');
    }

    // Log failure reason for debugging
    console.error('[Webhook] Payment failure reason:', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error?.message || 'Unknown'
    });

  } catch (error) {
    console.error('[Webhook] Error in handlePaymentFailure:', error);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Webhook] Checkout completed:', session.id);
  console.log('[Webhook] Mode:', session.mode);
  console.log('[Webhook] Metadata:', session.metadata);

  // Only handle subscription checkouts (membership signups)
  if (session.mode !== 'subscription') {
    console.log('[Webhook] Not a subscription, skipping');
    return;
  }

  const customerId = session.metadata?.customer_id;
  const authUserId = session.metadata?.auth_user_id;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  if (!customerId || !authUserId || !subscriptionId) {
    console.error('[Webhook] Missing required metadata:', { customerId, authUserId, subscriptionId });
    return;
  }

  try {
    // Check if membership already exists
    const { data: existingMembership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existingMembership) {
      console.log('[Webhook] Membership already exists for customer:', customerId);
      return;
    }

    // Calculate dates - use more reliable date math to avoid month overflow issues
    const startDate = new Date();
    const endDate = new Date(startDate);
    // Add 6 months (approximately 182 days to be safe)
    endDate.setDate(endDate.getDate() + 182);

    // Create membership record
    const { data: newMembership, error: insertError } = await supabaseAdmin
      .from('memberships')
      .insert({
        customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Webhook] Error creating membership:', insertError);
      return;
    }

    console.log('[Webhook] Membership created successfully:', newMembership.id);
    console.log('[Webhook] Active until:', endDate.toISOString().split('T')[0]);

  } catch (error) {
    console.error('[Webhook] Error handling checkout completion:', error);
  }
}

async function handleSubscriptionPayment(invoice: Stripe.Invoice) {
  console.log('Subscription payment succeeded:', invoice.id);

  // Handle recurring subscription payments (renewals)
  if (!invoice.subscription) {
    console.log('No subscription associated with invoice');
    return;
  }

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id;

  try {
    // Find membership by subscription ID
    const { data: membership, error: fetchError } = await supabaseAdmin
      .from('memberships')
      .select('id, end_date')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();

    if (fetchError || !membership) {
      console.error('Membership not found for subscription:', subscriptionId);
      return;
    }

    // Extend membership by 6 months (182 days) from current end_date
    const currentEndDate = new Date(membership.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + 182);

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        end_date: newEndDate.toISOString().split('T')[0],
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error('Error extending membership:', updateError);
      return;
    }

    console.log('Membership extended successfully to:', newEndDate.toISOString().split('T')[0]);
  } catch (error) {
    console.error('Error handling subscription payment:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);

  try {
    // Find membership by subscription ID
    const { data: membership, error: fetchError } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (fetchError || !membership) {
      console.error('Membership not found for subscription:', subscription.id);
      return;
    }

    // Map Stripe status to our status
    let status = 'active';
    if (subscription.status === 'canceled') {
      status = 'canceled';
    } else if (subscription.status === 'past_due') {
      status = 'past_due';
    } else if (subscription.status === 'trialing') {
      status = 'trialing';
    }

    // Update membership status
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error('Error updating membership status:', updateError);
      return;
    }

    console.log('Membership status updated to:', status);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);

  try {
    // Find membership by subscription ID
    const { data: membership, error: fetchError } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (fetchError || !membership) {
      console.error('Membership not found for subscription:', subscription.id);
      return;
    }

    // Mark membership as canceled
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error('Error canceling membership:', updateError);
      return;
    }

    console.log('Membership canceled successfully');
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}