/**
 * Driver Dropoff Endpoint
 * Handles driver delivery photo upload + status update to "delivered"
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../../../../utils/require-roles';
import { uploadImage, generatePhotoPath, validateImageFile } from '../../../../../utils/storage';

const serviceClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-dropoff] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    // 1️⃣ Auth check (admin or driver)
    // TODO: Replace with requireRole(cookies, ['driver', 'admin']) when driver role is implemented
    const { user } = await requireAdmin(cookies);
    const { id: orderId } = params;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Parse form data for photo upload
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const deliveryNotes = formData.get('deliveryNotes') as string;

    if (!photo) {
      return new Response(
        JSON.stringify({ error: 'Delivery photo is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Dropoff request received', { orderId, hasPhoto: !!photo, driverId: user.id });

    // 2️⃣ Validate image file
    await validateImageFile(photo);

    // 3️⃣ Retrieve order
    const { data: order, error: fetchError } = await serviceClient
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4️⃣ Validate transition (matches enum in orders_status_check)
    if (order.status !== 'en_route_delivery') {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition: ${order.status} → delivered`,
          validTransition: 'en_route_delivery → delivered',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5️⃣ Upload delivery photo with safe extension handling
    const ext = (photo.name?.split('.').pop() || 'jpg').toLowerCase();
    const photoPath = generatePhotoPath(orderId, 'delivery', ext);
    const photoUrl = await uploadImage(photo, photoPath);

    log('Delivery photo uploaded successfully:', { photoPath, photoUrl });

    const deliveredAt = new Date().toISOString();

    // 6️⃣ Update order (skip updated_at since we have database trigger)
    const updateData: any = {
      status: 'delivered',
      delivery_photo: photoUrl,
      delivered_at: deliveredAt,
      driver_id: user.id // Track which driver completed delivery
    };

    // Add delivery notes if provided
    if (deliveryNotes?.trim()) {
      updateData.delivery_notes = deliveryNotes.trim();
    }

    const { error: updateError } = await serviceClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('[driver-dropoff] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7️⃣ Log audit trail
    const { error: auditError } = await serviceClient.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: user.id,
      changed_at: deliveredAt,
    });

    if (auditError) {
      console.error('[driver-dropoff] Audit log error:', auditError);
      // Not fatal — continue
    }

    log('Order delivered successfully', { orderId, photoUrl });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: 'delivered',
        photoUrl,
        deliveredAt,
        deliveryNotes: deliveryNotes?.trim() || null,
        driverId: user.id,
        message: 'Order delivered successfully',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[driver-dropoff] Fatal error:', error);
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({
        error: 'Failed to process delivery',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const prerender = false;