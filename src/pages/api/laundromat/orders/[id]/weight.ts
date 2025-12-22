import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { getServiceClient } from '../../../../../utils/order-status';
import { calculateBagPricingWithOverweight, BAG_PRICING_CENTS } from '../../../../../utils/pricing';
import { checkMembershipStatus } from '../../../../../utils/membership';
import Stripe from 'stripe';
import { getConfig } from '../../../../../utils/env';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

const config = getConfig();
const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate as laundromat staff or admin
    const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);
    
    const orderId = params.id;
    const body = await request.json();
    const { weight } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!weight || isNaN(weight) || weight <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid weight is required (must be > 0)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = getServiceClient();

    // Verify the order belongs to this staff member's laundromat
    const { data: staffRecord } = await serviceClient
      .from('laundromat_staff')
      .select('laundromat_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!staffRecord && !roles.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'No laundromat assignment found' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the order with all necessary fields for payment calculation
    const { data: order } = await serviceClient
      .from('orders')
      .select('id, assigned_laundromat_id, measured_weight_lb, customer_id, pricing_model, stripe_payment_intent_id, total_cents, customers(auth_user_id)')
      .eq('id', orderId)
      .single();

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!roles.includes('admin') && order.assigned_laundromat_id !== staffRecord.laundromat_id) {
      return new Response(
        JSON.stringify({ error: 'Order not assigned to your laundromat' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const previousWeight = order.measured_weight_lb;
    const weightChange = weight - (previousWeight || 0);

    // Extract bag size from pricing_model (e.g., 'bag_small' -> 'small')
    const pricingModel = order.pricing_model;
    let bagSize: 'small' | 'medium' | 'large' | null = null;
    if (pricingModel?.startsWith('bag_')) {
      const size = pricingModel.replace('bag_', '');
      if (size === 'small' || size === 'medium' || size === 'large') {
        bagSize = size;
      }
    }

    // Calculate payment adjustment for bag orders
    let newTotalCents = order.total_cents;
    let overweightFee = 0;
    let paymentAdjusted = false;

    if (bagSize && order.stripe_payment_intent_id) {
      // Get customer's auth_user_id to check membership
      const authUserId = (order.customers as any)?.auth_user_id;
      const isMember = authUserId ? await checkMembershipStatus(authUserId, serviceClient) : false;

      // Calculate pricing with potential overage
      // Example: small bag (20 lb limit), 25 lbs actual, non-member
      // → $35 (base) + (5 lbs × $2.25) = $46.25
      const pricingResult = calculateBagPricingWithOverweight(bagSize, weight, isMember);
      newTotalCents = pricingResult.total;
      overweightFee = pricingResult.overweightResult.fee;

      // Update Stripe PaymentIntent if amount changed
      if (newTotalCents !== order.total_cents) {
        try {
          await stripe.paymentIntents.update(order.stripe_payment_intent_id, {
            amount: newTotalCents,
          });
          paymentAdjusted = true;
          console.log(`[weight.ts] Payment adjusted for order ${orderId}: ${order.total_cents}¢ → ${newTotalCents}¢`);
        } catch (stripeError) {
          console.error('[weight.ts] Failed to update Stripe PaymentIntent:', stripeError);
          return new Response(
            JSON.stringify({
              error: 'Failed to adjust payment amount',
              details: stripeError instanceof Error ? stripeError.message : 'Stripe error'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Update the order weight and total in database
    const { error: updateError } = await serviceClient
      .from('orders')
      .update({
        measured_weight_lb: weight,
        total_cents: newTotalCents,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to update order weight',
          details: updateError.message
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        previousWeight: previousWeight || 0,
        newWeight: weight,
        weightChange,
        paymentAdjusted,
        previousTotal: order.total_cents,
        newTotal: newTotalCents,
        overweightFee,
        message: paymentAdjusted
          ? `Order weight updated to ${weight} lbs. Payment adjusted to $${(newTotalCents / 100).toFixed(2)}`
          : `Order weight updated to ${weight} lbs`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating order weight:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update order weight',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};