/**
 * Driver Pickup Endpoint
 * Handles driver photo upload + status update to "picked_up"
 * ⚠️ SERVER-SIDE ONLY API ROUTE
 */

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../utils/require-roles';
import { uploadImage, generatePhotoPath, validateImageFile } from '../../../../../utils/storage';
import { updateOrderStatus } from '../../../../../utils/order-status';

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

    // Upload pickup photo with safe extension handling
    const ext = (photo.name?.split('.').pop() || 'jpg').toLowerCase();
    const photoPath = generatePhotoPath(orderId, 'pickup', ext);
    const photoUrl = await uploadImage(photo, photoPath);

    log('Photo uploaded successfully:', { photoPath, photoUrl });

    const pickedUpAt = new Date().toISOString();

    // Prepare additional data for status update
    const additionalData: any = {
      pickup_photo: photoUrl,
      picked_up_at: pickedUpAt,
      driver_id: user.id // Track which driver did the pickup
    };

    // Add actual weight if provided
    if (actualWeight && !isNaN(Number(actualWeight))) {
      additionalData.measured_weight_lb = Number(actualWeight);
    }

    // Update order status using centralized utility
    const result = await updateOrderStatus({
      orderId,
      newStatus: 'picked_up',
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

    log('Driver pickup completed successfully:', {
      orderId,
      photoUrl,
      actualWeight: additionalData.measured_weight_lb,
      driverId: user.id
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: result.status,
        photoUrl,
        pickedUpAt,
        actualWeight: additionalData.measured_weight_lb || null,
        driverId: user.id,
        updatedAt: result.updatedAt,
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