import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, generateTokenExpiration, generateMagicLink, sendOrderConfirmationEmail } from '../../utils/guest-auth';
import { checkMembershipStatus } from '../../utils/membership';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Create authenticated Supabase client with user session
    const sbAccessToken = cookies.get('sb-access-token')?.value;
    const sbRefreshToken = cookies.get('sb-refresh-token')?.value;

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    // Set the session if we have tokens
    if (sbAccessToken && sbRefreshToken) {
      await supabase.auth.setSession({
        access_token: sbAccessToken,
        refresh_token: sbRefreshToken
      });
    }

    const body = await request.json();

    // Log the received data for debugging
    console.log('[create-order] Received request body:', JSON.stringify(body, null, 2));

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
      estimatedAmount,
      authUserId // Pass this from the frontend if authenticated
    } = body;

    // Require authentication
    if (!authUserId) {
      console.error('[create-order] Unauthenticated request');
      return new Response(
        JSON.stringify({ error: 'Authentication required to place an order' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
    const isPerBagOrder = planType?.includes('bag') || orderType?.includes('bag');
    if (isPerBagOrder && authUserId) {
      const isMember = await checkMembershipStatus(authUserId, supabase);
      if (!isMember) {
        return new Response(
          JSON.stringify({
            error: 'Per-bag pricing is only available to members. Please become a member or choose per-pound pricing.'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (isPerBagOrder && !authUserId) {
      // Guest users trying to use per-bag pricing
      return new Response(
        JSON.stringify({
          error: 'Per-bag pricing is only available to members. Please sign in or choose per-pound pricing.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure access token
    const accessToken = generateAccessToken();
    const tokenExpiresAt = generateTokenExpiration();

    // Find or create customer record for authenticated user
    let customer;

    // First, try to find existing customer by auth_user_id
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (existingCustomer) {
      console.log('[create-order] Found existing customer:', existingCustomer.id);
      customer = existingCustomer;

      // Update customer info if it changed
      await supabase
        .from('customers')
        .update({
          full_name: customerName,
          email: customerEmail,
          phone: customerPhone
        })
        .eq('id', customer.id);
    } else {
      // Create new customer record for authenticated user
      console.log('[create-order] Creating new customer for auth user:', {
        auth_user_id: authUserId,
        full_name: customerName,
        email: customerEmail,
        phone: customerPhone,
        is_guest: false
      });

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authUserId,
          full_name: customerName,
          email: customerEmail,
          phone: customerPhone,
          is_guest: false
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

      console.log('[create-order] Customer created successfully:', newCustomer);
      customer = newCustomer;
    }

    // Create address if provided
    let addressId = null;
    if (pickupAddress) {
      const { data: address, error: addressError } = await supabase
        .from('addresses')
        .insert({
          customer_id: customer.id,
          label: 'Pickup Address',
          line1: pickupAddress.line1 || pickupAddress.address,
          line2: pickupAddress.line2,
          city: pickupAddress.city || 'Detroit',
          state: pickupAddress.state || 'MI',
          postal_code: pickupAddress.postal_code || pickupAddress.zip,
          latitude: pickupAddress.latitude,
          longitude: pickupAddress.longitude
        })
        .select()
        .single();

      if (!addressError) {
        addressId = address.id;
      }
    }

    // Resolve time window ID if it's a label instead of UUID
    let resolvedTimeWindowId = pickupTimeWindowId;

    // Check if pickupTimeWindowId is a UUID (contains hyphens) or a label
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pickupTimeWindowId || '');

    if (!isUUID && pickupTimeWindowId) {
      // It's a label like "morning", "afternoon", "evening" - look up the ID
      // Use case-insensitive search with ilike
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

    // Calculate estimated pricing
    let estimatedTotal = estimatedAmount || 3375; // Default $33.75 in cents

    // Create the order
    console.log('[create-order] Creating order with data:', {
      customer_id: customer.id,
      address_id: addressId,
      service_type: serviceType,
      pricing_model: pricingModel,
      plan_type: null,
      pickup_date: pickupDate,
      pickup_time_window_id: resolvedTimeWindowId,
      subtotal_cents: estimatedTotal,
      total_cents: estimatedTotal,
      status: 'scheduled',
      payment_status: 'requires_payment'
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customer.id,
        address_id: addressId,
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
        access_token: accessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: 'scheduled',
        payment_status: 'requires_payment'
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

    console.log('[create-order] Order created successfully:', order.id);

    // Generate magic link using the request origin
    const origin = new URL(request.url).origin;
    const baseUrl = origin || import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
    const magicLink = generateMagicLink(order.id, accessToken, baseUrl);

    // Send confirmation email
    const emailSent = await sendOrderConfirmationEmail(
      customerEmail,
      customerName || 'Valued Customer',
      order.id,
      magicLink,
      `$${(estimatedTotal / 100).toFixed(2)}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        accessToken: accessToken,
        magicLink: magicLink,
        emailSent: emailSent,
        message: 'Order created successfully! Check your email for the order details.'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating order:', error);
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