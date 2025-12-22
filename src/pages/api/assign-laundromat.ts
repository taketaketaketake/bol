import type { APIRoute } from 'astro';
import { requireRole } from '../../utils/require-role';
import { createAuthErrorResponse } from '../../utils/require-auth';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../../utils/env';
import { rateLimit, RATE_LIMITS } from '../../utils/rate-limit';

// Get validated configuration
const config = getConfig();

// Service role client for trusted system writes (bypasses RLS)
const serviceClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

// Helper for conditional logging
const log = (message: string, data?: any) => {
  if (import.meta.env.MODE !== 'production') {
    console.log(`[assign-laundromat] ${message}`, data || '');
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate and authorize (admin or laundromat staff only)
    const { user, roles, supabase } = await requireRole(cookies, ['admin', 'laundromat_staff']);

    const body = await request.json();
    const { orderId, laundromateId, zipCode } = body;

    // Validate required fields
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let assignedLaundromat = null;
    let assignmentMethod = 'manual';

    if (laundromateId) {
      // Manual assignment to specific laundromat
      log('Manual assignment to laundromat:', laundromateId);
      
      // Verify laundromat exists and is active
      const { data: laundromat, error: laundromatError } = await serviceClient
        .from('laundromats')
        .select('*')
        .eq('id', laundromateId)
        .eq('is_active', true)
        .single();

      if (laundromatError || !laundromat) {
        return new Response(
          JSON.stringify({ error: 'Laundromat not found or inactive' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      assignedLaundromat = laundromat;
      
    } else if (zipCode) {
      // Auto-assignment based on ZIP code
      log('Auto-assignment for ZIP:', zipCode);
      
      const { data: availableLaundromats, error: routingError } = await serviceClient
        .rpc('find_laundromat_by_zip', { incoming_zip: zipCode });

      if (routingError) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to find laundromats for ZIP code',
            details: routingError.message 
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!availableLaundromats || availableLaundromats.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: `No available laundromats found for ZIP code: ${zipCode}`,
            zipCode 
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      assignedLaundromat = availableLaundromats[0]; // Get least busy laundromat
      assignmentMethod = 'zip_match';
      
    } else {
      return new Response(
        JSON.stringify({ error: 'Either laundromateId or zipCode is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Assign the order to the laundromat using the database function
    const { data: assignmentResult, error: assignmentError } = await serviceClient
      .rpc('assign_order_to_laundromat', { 
        order_id: orderId, 
        laundromat_id: assignedLaundromat.id 
      });

    if (assignmentError) {
      console.error('[assign-laundromat] Assignment error:', assignmentError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to assign laundromat to order',
          details: assignmentError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the routing method in the order
    await serviceClient
      .from('orders')
      .update({ routing_method: assignmentMethod })
      .eq('id', orderId);

    log('Order assigned successfully:', { 
      orderId, 
      laundromateId: assignedLaundromat.id, 
      laundromatName: assignedLaundromat.name,
      method: assignmentMethod 
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        assignedLaundromat: {
          id: assignedLaundromat.id,
          name: assignedLaundromat.name,
          today_orders: assignedLaundromat.today_orders + 1, // Updated count
          max_daily_orders: assignedLaundromat.max_daily_orders,
          capacity_remaining: assignedLaundromat.max_daily_orders - (assignedLaundromat.today_orders + 1)
        },
        assignmentMethod,
        message: `Order assigned to ${assignedLaundromat.name}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error assigning laundromat:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to assign laundromat',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate and authorize (admin or laundromat staff only)
    const { user, roles, supabase } = await requireRole(cookies, ['admin', 'laundromat_staff']);

    const url = new URL(request.url);
    const zipCode = url.searchParams.get('zip');

    if (!zipCode) {
      return new Response(
        JSON.stringify({ error: 'ZIP code parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find available laundromats for the ZIP code
    const { data: availableLaundromats, error: routingError } = await serviceClient
      .rpc('find_laundromat_by_zip', { incoming_zip: zipCode });

    if (routingError) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to find laundromats for ZIP code',
          details: routingError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        zipCode,
        availableLaundromats: availableLaundromats || [],
        count: availableLaundromats ? availableLaundromats.length : 0
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error finding laundromats:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return createAuthErrorResponse(error.message);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to find laundromats',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};