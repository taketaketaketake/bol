import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';
import { getCustomerId } from '../../../utils/dashboard/customer';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const accessToken = cookies.get('sb-access-token');
    const refreshToken = cookies.get('sb-refresh-token');

    if (!accessToken || !refreshToken) {
      return redirect('/auth/login', 302);
    }

    // Set up Supabase client with cookies
    const { data: { session } } = await supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value
    });

    if (!session) {
      return redirect('/auth/login', 302);
    }

    // Get order ID from query params
    const url = new URL(request.url);
    const orderId = url.searchParams.get('id');

    if (!orderId) {
      return redirect('/dashboard', 302);
    }

    // Get customer ID to verify ownership
    const customerId = await getCustomerId(session.user.id, supabase);

    if (!customerId) {
      return redirect('/dashboard', 302);
    }

    // Fetch order to verify ownership and get payment info
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, customer_id, status, pickup_date, total_cents, stripe_payment_intent_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error('[Cancel Order] Error fetching order:', fetchError);
      return redirect('/dashboard?error=order_not_found', 302);
    }

    // Verify ownership
    if (order.customer_id !== customerId) {
      console.error('[Cancel Order] Customer does not own this order');
      return redirect('/dashboard?error=unauthorized', 302);
    }

    // Calculate refund amount based on timing and status
    const pickupDate = new Date(order.pickup_date);
    const now = new Date();
    const hoursUntilPickup = (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundAmount = 0;
    let refundReason = '';
    const cancellationFeeCents = 1000; // $10 in cents

    // Determine refund amount based on policy
    if (order.status === 'picked_up' || order.status === 'in_progress') {
      // Already picked up: 50% refund
      refundAmount = Math.floor(order.total_cents * 0.5);
      refundReason = '50% refund (order already picked up)';
    } else if (hoursUntilPickup >= 6) {
      // 6+ hours before pickup: Full refund
      refundAmount = order.total_cents;
      refundReason = 'Full refund (cancelled 6+ hours before pickup)';
    } else if (hoursUntilPickup > 0) {
      // Within 6 hours of pickup: Full amount minus $10 fee
      refundAmount = Math.max(0, order.total_cents - cancellationFeeCents);
      refundReason = 'Refund minus $10 cancellation fee (cancelled within 6 hours)';
    } else {
      // After scheduled pickup time: 50% refund
      refundAmount = Math.floor(order.total_cents * 0.5);
      refundReason = '50% refund (cancelled after scheduled pickup time)';
    }

    // Process Stripe refund if payment intent exists
    let stripeRefundId = null;
    if (order.stripe_payment_intent_id && refundAmount > 0) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            order_id: orderId,
            refund_reason: refundReason
          }
        });

        stripeRefundId = refund.id;
        console.log('[Cancel Order] Stripe refund created:', refund.id, 'Amount:', refundAmount);
      } catch (stripeError) {
        console.error('[Cancel Order] Stripe refund failed:', stripeError);
        return redirect(`/dashboard/orders/${orderId}?error=refund_failed`, 302);
      }
    }

    // Update order status to cancelled with refund info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        refund_amount_cents: refundAmount,
        refund_reason: refundReason,
        stripe_refund_id: stripeRefundId,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[Cancel Order] Error updating order:', updateError);
      return redirect(`/dashboard/orders/${orderId}?error=cancel_failed`, 302);
    }

    // Success - redirect back to dashboard with success message
    const refundDollars = (refundAmount / 100).toFixed(2);
    return redirect(`/dashboard?cancelled=true&refund=${refundDollars}`, 302);

  } catch (error) {
    console.error('[Cancel Order] Exception:', error);
    return redirect('/dashboard?error=unexpected', 302);
  }
};

export const prerender = false;
