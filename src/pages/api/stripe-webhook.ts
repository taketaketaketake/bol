import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');

  if (!sig || !endpointSecret) {
    console.error('Missing stripe signature or webhook secret');
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
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
  console.log('Payment succeeded:', paymentIntent.id);

  const metadata = paymentIntent.metadata;

  // TODO: Update your database with successful payment
  // - Create order record
  // - Update customer status
  // - Send confirmation email
  // - If membership was included, activate membership

  if (metadata.addMembership === 'true') {
    console.log('Membership included in payment, activating membership...');
    // TODO: Activate membership for customer
  }

  console.log('Order details:', {
    amount: paymentIntent.amount,
    orderType: metadata.orderType,
    customerEmail: metadata.customerEmail,
    pickupAddress: metadata.pickupAddress,
    pickupDate: metadata.pickupDate,
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  // TODO: Handle payment failure
  // - Log the failure
  // - Notify customer
  // - Update order status
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
    const { data: existingMembership } = await supabase
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

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    // Create membership record
    const { data: newMembership, error: insertError } = await supabase
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
    const { data: membership, error: fetchError } = await supabase
      .from('memberships')
      .select('id, end_date')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();

    if (fetchError || !membership) {
      console.error('Membership not found for subscription:', subscriptionId);
      return;
    }

    // Extend membership by 6 months from current end_date
    const currentEndDate = new Date(membership.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + 6);

    const { error: updateError } = await supabase
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
    const { data: membership, error: fetchError } = await supabase
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
    const { error: updateError } = await supabase
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
    const { data: membership, error: fetchError } = await supabase
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (fetchError || !membership) {
      console.error('Membership not found for subscription:', subscription.id);
      return;
    }

    // Mark membership as canceled
    const { error: updateError } = await supabase
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