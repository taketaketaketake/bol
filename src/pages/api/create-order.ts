import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, generateTokenExpiration, generateMagicLink, sendOrderConfirmationEmail } from '../../utils/guest-auth';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
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

    // Validate required fields
    if (!customerEmail || !pickupDate || !pickupTimeWindowId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, pickup date, and time window' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure access token
    const accessToken = generateAccessToken();
    const tokenExpiresAt = generateTokenExpiration();

    // Create or find customer (guest customer)
    let customer;

    // First, try to find existing customer by email
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', customerEmail)
      .single();

    if (existingCustomer) {
      customer = existingCustomer;
    } else {
      // Create new guest customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          full_name: customerName,
          email: customerEmail,
          phone: customerPhone,
          is_guest: true
        })
        .select()
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        return new Response(
          JSON.stringify({ error: 'Failed to create customer' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

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