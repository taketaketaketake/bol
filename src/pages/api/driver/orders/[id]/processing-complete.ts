/**
 * Driver Processing Complete Endpoint
 * Marks an order as "ready_for_delivery" after laundry is finished.
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { updateOrderStatus } from '../../../../../utils/order-status';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-processing] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, cookies, request }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 1️⃣ Auth check (driver or admin)
    const { user, roles } = await requireRole(cookies, ['driver', 'admin']);
    const { id: orderId } = params;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 });
    }

    log('Processing-complete request received', { orderId, driverId: user.id });

    const readyForDeliveryAt = new Date().toISOString();

    // Update order status using centralized utility
    const result = await updateOrderStatus({
      orderId,
      newStatus: 'ready_for_delivery',
      userId: user.id,
      additionalData: {
        ready_for_delivery_at: readyForDeliveryAt
      }
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

    log('Order marked ready for delivery', { orderId });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: result.status,
        readyForDeliveryAt,
        updatedAt: result.updatedAt,
        message: 'Order marked as ready for delivery successfully',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[driver-processing] Fatal error:', error);
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({
        error: 'Failed to mark order ready for delivery',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
};

export const prerender = false;