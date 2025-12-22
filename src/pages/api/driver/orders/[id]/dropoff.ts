/**
 * Driver Dropoff Endpoint
 * Handles driver delivery photo upload + status update to "delivered"
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { uploadImage, generatePhotoPath, validateImageFile } from '../../../../../utils/storage';
import { updateOrderStatus } from '../../../../../utils/order-status';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-dropoff] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, request, cookies }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // 1️⃣ Auth check (driver or admin)
    const { user, roles } = await requireRole(cookies, ['driver', 'admin']);
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

    // 3️⃣ Upload delivery photo with safe extension handling
    const ext = (photo.name?.split('.').pop() || 'jpg').toLowerCase();
    const photoPath = generatePhotoPath(orderId, 'delivery', ext);
    const photoUrl = await uploadImage(photo, photoPath);

    log('Delivery photo uploaded successfully:', { photoPath, photoUrl });

    const deliveredAt = new Date().toISOString();

    // Prepare additional data for status update
    const additionalData: any = {
      delivery_photo: photoUrl,
      delivered_at: deliveredAt,
      driver_id: user.id // Track which driver completed delivery
    };

    // Add delivery notes if provided
    if (deliveryNotes?.trim()) {
      additionalData.delivery_notes = deliveryNotes.trim();
    }

    // Update order status using centralized utility
    const result = await updateOrderStatus({
      orderId,
      newStatus: 'delivered',
      userId: user.id,
      additionalData
    });

    if (!result.success) {
      log('Status update failed:', { orderId, error: result.error });
      return new Response(
        JSON.stringify({
          error: result.error || 'Failed to update order status',
          validTransition: result.validTransition
        }),
        { status: result.error?.includes('not found') ? 404 : 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log('Order delivered successfully', { orderId, photoUrl });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: result.status,
        photoUrl,
        deliveredAt,
        deliveryNotes: additionalData.delivery_notes || null,
        driverId: user.id,
        updatedAt: result.updatedAt,
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