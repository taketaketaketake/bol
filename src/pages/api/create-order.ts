import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, generateTokenExpiration, generateMagicLink, sendOrderConfirmationEmail } from '../../utils/guest-auth';
import { checkMembershipStatus } from '../../utils/membership';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Create authenticated Supabase client with user session
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    // Set the session if we have tokens
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
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

    // Calculate estimated pricing
    let estimatedTotal = estimatedAmount || 3375; // Default $33.75 in cents

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customer.id,
        address_id: addressId,
        service_type: serviceType,
        plan_type: planType || orderType,
        pickup_date: pickupDate,
        pickup_time_window_id: pickupTimeWindowId,
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
      console.error('Error creating order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate magic link
    const baseUrl = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';
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