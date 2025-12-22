import type { APIRoute } from 'astro';
import { requireRole } from '../../../utils/require-role';
import { createAuthErrorResponse } from '../../../utils/require-auth';
import { PaymentStatus } from '../../../utils/payment-status';
import { checkBagOverweight, calculateBagPricingWithOverweight } from '../../../utils/pricing';
import { checkMembershipStatus } from '../../../utils/membership';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { rateLimit, RATE_LIMITS } from '../../../utils/rate-limit';

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
    console.log(`[adjust-weight] ${message}`, data || '');
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Require admin access for weight adjustments
    const { user, roles } = await requireRole(cookies, ['admin']);

    const body = await request.json();
    const { orderId, actualWeight } = body;

    // Validate required fields
    if (!orderId || !actualWeight) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: orderId and actualWeight'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate weight is positive
    if (actualWeight <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Actual weight must be greater than 0'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Processing weight adjustment:', { orderId, actualWeight, adminUserId: user.id });

    // Retrieve the order from database with customer info for membership check
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('*, customers(auth_user_id)')
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

    // Validate this is strictly a bag order with proper pricing model
    const validBagModels = ['bag_small', 'bag_medium', 'bag_large'];
    if (!validBagModels.includes(order.pricing_model)) {
      return new Response(
        JSON.stringify({
          error: 'Weight adjustment only available for bag orders',
          currentPricingModel: order.pricing_model,
          validModels: validBagModels
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract bag size from pricing_model (e.g., 'bag_medium' -> 'medium')
    const bagSize = order.pricing_model.replace('bag_', '') as 'small' | 'medium' | 'large';

    // Prevent double adjustment with enhanced guards
    if (order.weight_limit_exceeded || order.overweight_payment_intent_id || 
        (order.measured_weight_lb && order.bag_overweight_cents)) {
      return new Response(
        JSON.stringify({
          error: 'Weight adjustment already processed for this order',
          details: 'Contact support to reopen order for re-adjustment',
          currentWeight: order.measured_weight_lb,
          currentOverweightFee: order.bag_overweight_cents,
          weightLimitExceeded: order.weight_limit_exceeded,
          existingPaymentIntent: !!order.overweight_payment_intent_id
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check membership status to determine correct per-pound rate
    const authUserId = (order.customers as any)?.auth_user_id;
    const isMember = authUserId ? await checkMembershipStatus(authUserId, serviceClient) : false;

    // Calculate overweight fees with correct member rate
    const overweightResult = checkBagOverweight(bagSize, actualWeight, isMember);
    const pricingResult = calculateBagPricingWithOverweight(bagSize, actualWeight, isMember);
    
    log('Overweight calculation:', { 
      bagSize, 
      actualWeight, 
      overweightResult, 
      pricingResult 
    });

    // If no overweight, just update the measured weight
    if (!overweightResult.overweight) {
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          measured_weight_lb: actualWeight,
          weight_limit_exceeded: false,
          bag_overweight_cents: 0
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('[adjust-weight] Error updating order:', updateError);
        return new Response(
          JSON.stringify({
            error: 'Failed to update order weight'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          overweight: {
            exceeded: false,
            actualWeight: actualWeight,
            weightLimit: overweightResult.weightLimit,
            overageLbs: 0,
            feeCharged: 0,
            newTotal: order.total_cents
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle overweight scenario - create additional Stripe charge with idempotency
    try {
      // Generate idempotency key to prevent duplicate overweight charges
      const idempotencyKey = `overweight:${orderId}:${actualWeight}`;
      
      const overweightPayment = await stripe.paymentIntents.create({
        amount: overweightResult.fee,
        currency: 'usd',
        capture_method: 'automatic',
        metadata: {
          order_id: orderId,
          original_order_total: String(order.total_cents),
          overweight_fee: String(overweightResult.fee),
          overage_lbs: String(overweightResult.overageLbs),
          bag_size: bagSize,
          admin_user_id: user.id
        },
        description: `Overweight fee - Order ${orderId.slice(0, 8)} - ${overweightResult.overageLbs}lbs over limit`
      }, { 
        idempotencyKey 
      });

      log('Overweight payment intent created:', { 
        paymentIntentId: overweightPayment.id, 
        amount: overweightResult.fee 
      });

      // Update order with overweight details and new total
      const newTotal = order.total_cents + overweightResult.fee;
      
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          measured_weight_lb: actualWeight,
          weight_limit_exceeded: true,
          bag_overweight_cents: overweightResult.fee,
          total_cents: newTotal,
          overweight_payment_intent_id: overweightPayment.id,
          overweight_stripe_charge_id: overweightPayment.latest_charge || null
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('[adjust-weight] Error updating order with overweight fee:', updateError);
        // Continue anyway - payment was created successfully
      }

      log('Weight adjustment completed:', {
        orderId,
        actualWeight,
        overweightFee: overweightResult.fee,
        newTotal
      });

      return new Response(
        JSON.stringify({
          success: true,
          overweight: {
            exceeded: true,
            actualWeight: actualWeight,
            weightLimit: overweightResult.weightLimit,
            overageLbs: overweightResult.overageLbs,
            feeCharged: overweightResult.fee,
            newTotal: newTotal,
            paymentIntentId: overweightPayment.id,
            stripeChargeId: overweightPayment.latest_charge || null,
            paymentStatus: overweightPayment.status,
            captured: overweightPayment.status === 'succeeded'
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (stripeError) {
      console.error('[adjust-weight] Failed to create overweight payment:', stripeError);
      
      return new Response(
        JSON.stringify({
          error: 'Failed to create overweight payment',
          details: stripeError instanceof Error ? stripeError.message : 'Stripe error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[adjust-weight] Error processing weight adjustment:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process weight adjustment',
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