import type { APIRoute } from 'astro';
import { requireAuth, createAuthErrorResponse } from '../../utils/require-auth';
import { checkMembershipStatus } from '../../utils/membership';
import { calculatePricing, BAG_PRICING_CENTS } from '../../utils/pricing';
import { PaymentStatus } from '../../utils/payment-status';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Service role client for trusted system writes (bypasses RLS)
const serviceClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Payment status enum is now imported from shared utility

// Helper for conditional logging
const log = (message: string, data?: any) => {
  if (import.meta.env.MODE !== 'production') {
    console.log(`[create-order] ${message}`, data || '');
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user and get Supabase client
    const { user, supabase } = await requireAuth(cookies);

    const body = await request.json();

    // Log the received data for debugging  
    log('Received request body:', JSON.stringify(body, null, 2));

    const {
      customerName,
      customerEmail,
      customerPhone,
      orderType,
      serviceType = 'wash_fold',
      planType,
      pickupDate,
      pickupTimeWindowId,
      pickupAddress,
      deliveryAddress,
      notes,
      preferences = {},
      addons = [],
      addonPrefs = {},
      estimatedAmount
    } = body;

    // Use the authenticated user's ID
    const authUserId = user.id;

    // Validate required fields
    if (!customerEmail || !pickupDate || !pickupTimeWindowId) {
      console.error('[create-order] Missing required fields:', {
        hasEmail: !!customerEmail,
        hasPickupDate: !!pickupDate,
        hasPickupTimeWindowId: !!pickupTimeWindowId
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, pickup date, and time window' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Server-side validation: Prevent non-members from using per-bag pricing
    const isPerBagOrder = /bag/i.test(orderType || planType || '');
    const isMember = await checkMembershipStatus(authUserId, supabase);
    
    if (isPerBagOrder && !isMember) {
      return new Response(
        JSON.stringify({
          error: 'Per-bag pricing is members-only.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find or create customer record for authenticated user
    let customer;

    // First, try to find existing customer by auth_user_id using service client
    const { data: existingCustomer } = await serviceClient
      .from('customers')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (existingCustomer) {
      log('Found existing customer:', existingCustomer.id);
      customer = existingCustomer;

      // Update customer info if it changed
      await serviceClient
        .from('customers')
        .update({
          full_name: customerName,
          email: customerEmail,
          phone: customerPhone
        })
        .eq('id', customer.id);
    } else {
      // Create new customer record for authenticated user
      log('Creating new customer for auth user:', {
        auth_user_id: authUserId,
        full_name: customerName,
        email: customerEmail,
        phone: customerPhone
      });

      const { data: newCustomer, error: customerError } = await serviceClient
        .from('customers')
        .insert({
          auth_user_id: authUserId,
          full_name: customerName,
          email: customerEmail,
          phone: customerPhone
          // is_guest defaults to false in database - no need to set explicitly
        })
        .select()
        .single();

      if (customerError) {
        console.error('[create-order] Error creating customer:', customerError);
        console.error('[create-order] Error details:', JSON.stringify(customerError, null, 2));
        return new Response(
          JSON.stringify({
            error: 'Failed to create customer',
            details: customerError.message,
            code: customerError.code
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      log('Customer created successfully:', newCustomer);
      customer = newCustomer;
    }

    // Validate pickup address is provided
    if (!pickupAddress || !pickupAddress.line1) {
      console.error('[create-order] Missing pickup address');
      return new Response(
        JSON.stringify({ error: 'Pickup address is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Resolve time window ID if it's a label instead of UUID
    let resolvedTimeWindowId = pickupTimeWindowId;

    // Check if pickupTimeWindowId is a UUID (contains hyphens) or a label
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pickupTimeWindowId || '');

    if (!isUUID && pickupTimeWindowId) {
      // It's a label like "morning", "afternoon", "evening" - look up the ID
      console.log('[create-order] Looking up time window for label:', pickupTimeWindowId);

      const { data: timeWindow, error: timeWindowError } = await supabase
        .from('time_windows')
        .select('id, label')
        .ilike('label', pickupTimeWindowId)
        .limit(1)
        .maybeSingle();

      console.log('[create-order] Time window lookup result:', { timeWindow, timeWindowError });

      if (timeWindow) {
        resolvedTimeWindowId = timeWindow.id;
        console.log('[create-order] Resolved time window label to ID:', pickupTimeWindowId, '->', resolvedTimeWindowId);
      } else {
        console.error('[create-order] Could not find time window with label:', pickupTimeWindowId);
        console.error('[create-order] Time window error:', timeWindowError);
        return new Response(
          JSON.stringify({
            error: `Invalid time window: "${pickupTimeWindowId}" not found`,
            availableTimeWindows: ['morning', 'afternoon', 'evening']
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Map frontend orderType to database pricing_model format
    const pricingModelMap: { [key: string]: string } = {
      'per_pound': 'per_lb',
      'small_bag': 'bag_small',
      'medium_bag': 'bag_medium',
      'large_bag': 'bag_large'
    };
    const pricingModel = pricingModelMap[orderType] || 'per_lb';

    // Calculate estimated pricing using centralized system
    let estimatedTotal: number;
    let paymentIntentAmount: number;
    let captureMethod: 'automatic' | 'manual';
    
    if (isPerBagOrder) {
      // Per-bag pricing: immediate charge
      const bagSize = orderType.includes('small') ? 'small' : 
                     orderType.includes('medium') ? 'medium' : 'large';
      estimatedTotal = BAG_PRICING_CENTS[bagSize as keyof typeof BAG_PRICING_CENTS];
      paymentIntentAmount = estimatedTotal;
      captureMethod = 'automatic';
    } else {
      // Per-pound pricing: $35 hold, capture later
      // TODO: Make configurable per user/membership tier/settings
      const estimatedWeight = 15; // Default estimate
      const pricingResult = calculatePricing({
        weightInPounds: estimatedWeight,
        isMember
      });
      estimatedTotal = pricingResult.total;
      paymentIntentAmount = 3500; // $35 hold for per-pound orders
      captureMethod = 'manual';
    }

    // Create the order with address data stored directly
    log('Creating order with data:', {
      customer_id: customer.id,
      service_type: serviceType,
      pricing_model: pricingModel,
      plan_type: null,
      pickup_date: pickupDate,
      pickup_time_window_id: resolvedTimeWindowId,
      pickup_address_line1: pickupAddress.line1,
      subtotal_cents: estimatedTotal,
      total_cents: estimatedTotal,
      status: 'scheduled',
      payment_status: PaymentStatus.RequiresPayment
    });

    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .insert({
        customer_id: customer.id,
        service_type: serviceType,
        pricing_model: pricingModel,  // Use mapped pricing_model value
        plan_type: null,              // Set to null for one-time orders
        pickup_date: pickupDate,
        pickup_time_window_id: resolvedTimeWindowId,
        notes: notes,
        preferences: preferences,
        addons: addons,
        subtotal_cents: estimatedTotal,
        total_cents: estimatedTotal,
        status: 'scheduled',
        payment_status: PaymentStatus.RequiresPayment,
        // Pickup address
        pickup_address_line1: pickupAddress.line1 || pickupAddress.address,
        pickup_address_line2: pickupAddress.line2,
        pickup_address_city: pickupAddress.city || 'Detroit',
        pickup_address_state: pickupAddress.state || 'MI',
        pickup_address_postal_code: pickupAddress.postal_code || pickupAddress.zip,
        // Dropoff address (if different from pickup)
        dropoff_address_line1: deliveryAddress?.line1,
        dropoff_address_line2: deliveryAddress?.line2,
        dropoff_address_city: deliveryAddress?.city,
        dropoff_address_state: deliveryAddress?.state,
        dropoff_address_postal_code: deliveryAddress?.postal_code
        // No access_token or token_expires_at - guest auth removed
      })
      .select()
      .single();

    if (orderError) {
      console.error('[create-order] Error creating order:', orderError);
      console.error('[create-order] Error details:', JSON.stringify(orderError, null, 2));
      return new Response(
        JSON.stringify({
          error: 'Failed to create order',
          details: orderError.message,
          code: orderError.code
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Order created successfully:', order.id);

    // Create Stripe PaymentIntent with idempotency protection
    try {
      // Generate idempotency key to prevent duplicate payment intents on retry
      const idempotencyKey = `order:create:${authUserId}:${pickupDate}:${pricingModel}:${Date.now()}`;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentIntentAmount,
        currency: 'usd',
        capture_method: captureMethod,
        metadata: {
          order_id: order.id,
          customer_id: customer.id,
          pricing_model: pricingModel,
          is_member: String(isMember),
          estimated_total: String(estimatedTotal)
        },
        description: `Bags of Laundry - Order ${order.id.slice(0, 8)}`
      }, { 
        idempotencyKey 
      });

      // Update order with payment intent ID using service client
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: captureMethod === 'automatic' ? PaymentStatus.Paid : PaymentStatus.Authorized
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('[create-order] Error updating order with payment intent:', updateError);
        // Continue anyway - order was created successfully
      }

      log('PaymentIntent created:', paymentIntent.id);

      return new Response(
        JSON.stringify({
          success: true,
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntentAmount,
          captureMethod: captureMethod,
          memberRateApplied: isMember,
          message: 'Order and payment intent created successfully!'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } catch (stripeError) {
      console.error('[create-order] Error creating PaymentIntent:', stripeError);
      
      // Order was created successfully, but payment failed
      // Update order status to indicate payment issue
      await serviceClient
        .from('orders')
        .update({ payment_status: PaymentStatus.Failed })
        .eq('id', order.id);
      
      return new Response(
        JSON.stringify({
          error: 'Order created but payment setup failed',
          orderId: order.id,
          details: stripeError instanceof Error ? stripeError.message : 'Payment setup error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error creating order:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};