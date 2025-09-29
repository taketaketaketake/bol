import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      orderId,
      paymentIntentId,
      actualWeight,
      ratePerPound = 249, // $2.49 per pound in cents
      minimumCharge = 3500, // $35 minimum in cents
      addOns = [],
      rushFee = 0
    } = body;

    // Calculate actual total based on weight
    const weightCharge = Math.round(actualWeight * ratePerPound);
    const serviceCharge = Math.max(weightCharge, minimumCharge);

    // Calculate add-ons
    const addOnTotal = addOns.reduce((sum: number, addon: any) => sum + addon.price, 0);

    const finalTotal = serviceCharge + addOnTotal + rushFee;

    // Get the payment intent to check current authorized amount
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const authorizedAmount = paymentIntent.amount;

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
        rush_fee_cents: rushFee,
        total_cents: finalTotal,
        payment_status: 'paid',
        status: 'processing'
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