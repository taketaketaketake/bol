import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../utils/auth';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const redirectTo = url.searchParams.get('redirect') || '/order-type';

  // Validate session_id parameter
  if (!sessionId) {
    console.error('Missing session_id parameter');
    return redirect('/membership?error=missing_session_id');
  }

  // Check user authentication
  const session = await getSession(cookies);
  if (!session?.user?.id) {
    console.error('User not authenticated');
    return redirect('/auth/login?redirect=/membership');
  }

  try {
    // 1. Retrieve Checkout Session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (checkoutSession.payment_status !== 'paid') {
      console.error('Payment not completed:', checkoutSession.payment_status);
      return redirect('/membership?error=payment_incomplete');
    }

    // 2. Get subscription details
    const subscription = checkoutSession.subscription as Stripe.Subscription;
    if (!subscription) {
      console.error('No subscription found for checkout session');
      return redirect('/membership?error=no_subscription');
    }

    const stripeCustomerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    // 3. Find or create customer record in Supabase
    const authUserId = session.user.id;
    const customerEmail = session.user.email || '';

    // Check if customer already exists
    const { data: existingCustomer, error: customerFetchError } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (customerFetchError) {
      console.error('Error fetching customer:', customerFetchError);
      return redirect(`${redirectTo}?error=database_error`);
    }

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;

      // Update stripe_customer_id if not set
      await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', customerId);
    } else {
      // Create new customer record
      const { data: newCustomer, error: customerCreateError } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authUserId,
          email: customerEmail,
          stripe_customer_id: stripeCustomerId,
          is_guest: false,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
          phone: session.user.phone || '',
        })
        .select('id')
        .single();

      if (customerCreateError || !newCustomer) {
        console.error('Error creating customer:', customerCreateError);
        console.error('Customer create error details:', JSON.stringify(customerCreateError, null, 2));
        console.error('Attempted to insert:', {
          auth_user_id: authUserId,
          email: customerEmail,
          stripe_customer_id: stripeCustomerId,
          is_guest: false,
        });
        return redirect(`${redirectTo}?error=customer_creation_failed&details=${encodeURIComponent(customerCreateError?.message || 'unknown')}`);
      }

      customerId = newCustomer.id;
    }

    // 4. Check if membership already exists
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (existingMembership) {
      // Membership already activated (idempotency check)
      console.log('Membership already exists, skipping creation');
      return redirect(`${redirectTo}?membership=already_active`);
    }

    // 5. Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6); // Add 6 months

    // 6. Insert membership record
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        customer_id: customerId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: 'active',
        membership_type: '6_month',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      return redirect(`${redirectTo}?error=membership_creation_failed`);
    }

    // Success! Redirect to original page
    console.log('Membership activated successfully for customer:', customerId);
    return redirect(`${redirectTo}?membership=activated`);

  } catch (error) {
    console.error('Error verifying membership payment:', error);
    return redirect('/membership?error=verification_failed');
  }
};
