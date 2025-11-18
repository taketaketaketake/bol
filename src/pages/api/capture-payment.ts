import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { calculatePricing } from '../../utils/pricing';
import { getMemberIfPresent } from '../../utils/require-roles';
import { getConfig } from '../../utils/env';

// Get validated configuration
const config = getConfig();

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

// Use service role key for trusted server-side operations (bypasses RLS)
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const {
      orderId,
      paymentIntentId,
      actualWeight,
      addOns = [],
      rushFee = 0
    } = body;

    // Check membership status to determine correct rate
    const memberResult = await getMemberIfPresent(cookies);
    const isMember = memberResult !== null;

    // Use centralized pricing logic for consistency
    const pricingResult = calculatePricing({
      weightInPounds: actualWeight,
      isMember
    });
    
    const serviceCharge = pricingResult.total;
    const ratePerPound = pricingResult.ratePerPound!;

    // Calculate add-ons
    const addOnTotal = addOns.reduce((sum: number, addon: any) => sum + addon.price, 0);

    const finalTotal = serviceCharge + addOnTotal + rushFee;

    // Get the payment intent to check current authorized amount
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const authorizedAmount = paymentIntent.amount;

    // Log weight differences for monitoring and store anomalies
    const amountDifference = Math.abs(finalTotal - authorizedAmount);
    if (amountDifference > 100) { // More than $1 difference
      console.info(`[CAPTURE] Significant amount change: authorized=${authorizedAmount}, final=${finalTotal}, orderId=${orderId}`);
      
      // Store anomaly for analytics (non-blocking)
      supabase
        .from('payment_anomalies')
        .insert({
          order_id: orderId,
          payment_intent_id: paymentIntentId,
          authorized_amount: authorizedAmount,
          final_amount: finalTotal,
          difference_cents: finalTotal - authorizedAmount,
          created_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.warn('[CAPTURE] Failed to log anomaly:', error);
        });
    }

    if (finalTotal > authorizedAmount) {
      // Need to update the payment intent amount before capturing
      await stripe.paymentIntents.update(paymentIntentId, {
        amount: finalTotal,
      });
    }

    // Capture the payment for the final amount
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: finalTotal,
    });

    // Update order in database with final pricing
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        measured_weight_lb: actualWeight,
        unit_rate_cents: ratePerPound,
        subtotal_cents: serviceCharge,
        add_on_total_cents: addOnTotal,
        rush_fee_cents: rushFee,
        total_cents: finalTotal,
        payment_status: 'paid',
        status: 'processing',
        // Store membership status for record keeping
        member_rate_applied: isMember,
        minimum_order_applied: pricingResult.minimumOrderApplied,
        // Store Stripe charge ID for financial reconciliation
        stripe_charge_id: capturedPayment.latest_charge || capturedPayment.id
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        capturedAmount: finalTotal,
        actualWeight: actualWeight,
        memberRateApplied: isMember,
        ratePerPound: ratePerPound,
        minimumOrderApplied: pricingResult.minimumOrderApplied,
        memberSavings: pricingResult.savings,
        stripeChargeId: capturedPayment.latest_charge || capturedPayment.id,
        priceBreakdown: {
          serviceCharge,
          addOns: addOnTotal,
          rushFee,
          total: finalTotal
        },
        paymentStatus: 'captured'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error capturing payment:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to capture payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};