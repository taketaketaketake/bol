/**
 * Driver Pickup Endpoint
 * Handles driver photo upload + status update to "picked_up"
 * ⚠️ SERVER-SIDE ONLY API ROUTE
 */

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../utils/require-roles';
import { uploadImage, generatePhotoPath, validateImageFile } from '../../../../../utils/storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Service role client for trusted database operations
const serviceClient: SupabaseClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper for conditional logging
const log = (message: string, data?: any) => {
  if (import.meta.env.MODE !== 'production') {
    console.log(`[driver-pickup] ${message}`, data || '');
  }
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    // Require admin/driver authentication
    const { user } = await requireAdmin(cookies);
    
    const { id: orderId } = params;
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data for photo upload
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const actualWeight = formData.get('actualWeight') as string;

    if (!photo) {
      return new Response(
        JSON.stringify({ error: 'Pickup photo is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Processing driver pickup:', { orderId, hasPhoto: !!photo, actualWeight, driverId: user.id });

    // Validate image file
    await validateImageFile(photo);

    // Retrieve the order from database
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, status, customer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      log('Order not found:', { orderId, error: orderError });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate status transition
    if (order.status !== 'scheduled') {
      return new Response(
        JSON.stringify({
          error: `Cannot pickup order with status: ${order.status}`,
          currentStatus: order.status,
          validTransition: 'scheduled → picked_up'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Upload pickup photo with safe extension handling
    const ext = (photo.name?.split('.').pop() || 'jpg').toLowerCase();
    const photoPath = generatePhotoPath(orderId, 'pickup', ext);
    const photoUrl = await uploadImage(photo, photoPath);

    log('Photo uploaded successfully:', { photoPath, photoUrl });

    const pickedUpAt = new Date().toISOString();

    // Prepare update data (skip updated_at since we have database trigger)
    const updateData: any = {
      status: 'picked_up',
      pickup_photo: photoUrl,
      picked_up_at: pickedUpAt,
      driver_id: user.id // Track which driver did the pickup
    };

    // Add actual weight if provided
    if (actualWeight && !isNaN(Number(actualWeight))) {
      updateData.measured_weight_lb = Number(actualWeight);
    }

    // Update order status and photo
    const { error: updateError } = await serviceClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('[driver-pickup] Error updating order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log status change to audit trail
    const { error: auditError } = await serviceClient
      .from('order_status_history')
      .insert({
        order_id: orderId,
        status: 'picked_up',
        changed_by: user.id,
        changed_at: pickedUpAt
      });

    if (auditError) {
      console.error('[driver-pickup] Error logging status change:', auditError);
      // Continue anyway - main operation succeeded
    }

    log('Driver pickup completed successfully:', {
      orderId,
      photoUrl,
      actualWeight: updateData.measured_weight_lb,
      driverId: user.id
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: 'picked_up',
        photoUrl,
        pickedUpAt,
        actualWeight: updateData.measured_weight_lb || null,
        driverId: user.id,
        message: 'Order picked up successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[driver-pickup] Error processing pickup:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process pickup',
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