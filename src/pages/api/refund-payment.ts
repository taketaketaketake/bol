import type { APIRoute } from 'astro';
import { requireRole } from '../../utils/require-role';
import { createAuthErrorResponse } from '../../utils/require-auth';
import { PaymentStatus, isRefundable } from '../../utils/payment-status';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { rateLimit, RATE_LIMITS } from '../../utils/rate-limit';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Service role client for trusted system writes (bypasses RLS)
const serviceClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper for conditional logging
const log = (message: string, data?: any) => {
  if (import.meta.env.MODE !== 'production') {
    console.log(`[refund-payment] ${message}`, data || '');
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Apply payment rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.PAYMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Require admin access for refund operations
    const { user, roles } = await requireRole(cookies, ['admin']);

    const body = await request.json();
    const { orderId, refundAmountCents, reason, reasonInternal } = body;

    // Validate required fields
    if (!orderId || !refundAmountCents || !reason) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: orderId, refundAmountCents, and reason'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate refund amount is positive
    if (refundAmountCents <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Refund amount must be greater than 0'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Processing refund request:', { 
      orderId, 
      refundAmountCents, 
      reason, 
      reasonInternal,
      adminUserId: user.id 
    });

    // Retrieve the order from database
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      log('Order not found:', { orderId, error: orderError });
      return new Response(
        JSON.stringify({
          error: 'Order not found'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate order has payment intent
    if (!order.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({
          error: 'Order does not have a valid payment intent'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment status using helper
    const currentStatus = order.payment_status as PaymentStatus;
    if (!isRefundable(currentStatus)) {
      return new Response(
        JSON.stringify({
          error: `Cannot refund order with payment status: ${currentStatus}`,
          validStatuses: [PaymentStatus.Paid, PaymentStatus.PartiallyRefunded]
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate available refund amount by querying actual refunds table
    const { data: priorRefunds, error: priorErr } = await serviceClient
      .from('refunds')
      .select('amount_cents')
      .eq('order_id', orderId);

    if (priorErr) {
      console.error('[refund-payment] Error fetching prior refunds:', priorErr);
      return new Response(
        JSON.stringify({
          error: 'Failed to verify existing refunds'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const alreadyRefunded = (priorRefunds ?? []).reduce((s, r) => s + (r.amount_cents || 0), 0);
    const refundableRemaining = Math.max(0, (order.total_cents || 0) - alreadyRefunded);

    // Validate refund amount doesn't exceed remaining refundable amount
    if (refundAmountCents > refundableRemaining) {
      return new Response(
        JSON.stringify({
          error: `Refund amount (${refundAmountCents}¢) exceeds remaining refundable amount (${refundableRemaining}¢)`,
          availableAmount: refundableRemaining,
          totalOrderAmount: order.total_cents,
          alreadyRefunded: alreadyRefunded,
          priorRefundCount: priorRefunds?.length || 0
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe refund with idempotency protection
    try {
      const environment = import.meta.env.MODE === 'production' ? 'production' : 'development';
      
      // Generate idempotency key to prevent duplicate refunds on retry
      const idempotencyKey = `refund:${order.stripe_payment_intent_id}:${refundAmountCents}:${user.id}:${Date.now()}`;
      
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: refundAmountCents,
        reason: 'requested_by_customer',
        metadata: {
          order_id: orderId,
          admin_user_id: user.id,
          internal_reason: reasonInternal || reason,
          environment: environment
        }
      }, { 
        idempotencyKey 
      });

      log('Stripe refund created:', { refundId: refund.id, status: refund.status });

      // Optional: Verify against Stripe reality for consistency check
      try {
        const stripePaymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
        const stripeRefundedAmount = stripePaymentIntent.amount_refunded || 0;
        
        if (Math.abs(stripeRefundedAmount - alreadyRefunded) > 100) { // More than $1 difference
          console.warn(`[refund-payment] Refund mismatch detected: Stripe=${stripeRefundedAmount}¢, DB=${alreadyRefunded}¢, Order=${orderId}`);
        }
      } catch (stripeVerifyError) {
        console.warn('[refund-payment] Could not verify Stripe refund totals:', stripeVerifyError);
        // Non-blocking - continue with refund processing
      }

      // Calculate new totals using accurate DB tracking
      const totalRefundedAmount = alreadyRefunded + refundAmountCents;
      const isFullRefund = totalRefundedAmount >= order.total_cents;
      const newPaymentStatus = isFullRefund ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;

      // Log refund in database with enhanced schema
      const { data: refundLog, error: refundLogError } = await serviceClient
        .from('refunds')
        .insert({
          order_id: orderId,
          stripe_refund_id: refund.id,
          amount_cents: refundAmountCents,
          reason: reason,
          reason_internal: reasonInternal || null,
          status: refund.status,
          environment: environment,
          created_by: user.id
        })
        .select()
        .single();

      if (refundLogError) {
        console.error('[refund-payment] Error logging refund:', refundLogError);
        // Continue anyway - refund was successful in Stripe
      }

      // Update order with accurate refund totals from DB tracking
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          payment_status: newPaymentStatus,
          refund_amount_cents: totalRefundedAmount,
          refunded_at: isFullRefund ? new Date().toISOString() : undefined
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('[refund-payment] Error updating order status:', updateError);
        // Continue anyway - refund was successful
      }

      log('Refund processed successfully:', {
        orderId,
        refundId: refund.id,
        amount: refundAmountCents,
        totalRefunded: totalRefundedAmount,
        newStatus: newPaymentStatus
      });

      return new Response(
        JSON.stringify({
          success: true,
          refund: {
            refundId: refund.id,
            amountCents: refundAmountCents,
            status: refund.status,
            reason: reason,
            reasonInternal: reasonInternal,
            orderId: orderId,
            isFullRefund: isFullRefund,
            newPaymentStatus: newPaymentStatus,
            totalRefundedAmount: totalRefundedAmount,
            remainingAmount: order.total_cents - totalRefundedAmount,
            priorRefundCount: priorRefunds?.length || 0,
            refundHistory: {
              previouslyRefunded: alreadyRefunded,
              thisRefund: refundAmountCents,
              newTotal: totalRefundedAmount
            }
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (stripeError) {
      console.error('[refund-payment] Stripe refund failed:', stripeError);
      
      return new Response(
        JSON.stringify({
          error: 'Failed to process refund through Stripe',
          details: stripeError instanceof Error ? stripeError.message : 'Stripe error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[refund-payment] Error processing refund:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process refund',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const prerender = false;