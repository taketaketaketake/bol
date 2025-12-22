/**
 * Driver Pickup from Laundromat Endpoint
 * Marks an order as "en_route_delivery" when driver collects from laundromat.
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { updateOrderStatus } from '../../../../../utils/order-status';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-pickup-laundromat] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, cookies, request }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try{
    // 1️⃣ Auth check (driver or admin)
    const { user, roles } = await requireRole(cookies, ['driver', 'admin']);
    const { id: orderId } = params;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 });
    }

    log('Pickup from laundromat request received', { orderId, driverId: user.id });

    // Update order status using centralized utility
    const result = await updateOrderStatus({
      orderId,
      newStatus: 'en_route_delivery',
      userId: user.id
      // No additional data needed for this transition
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

    log('Order marked as en route for delivery', { orderId });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: result.status,
        enRouteAt: result.updatedAt,
        updatedAt: result.updatedAt,
        message: 'Order picked up from laundromat - en route for delivery',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[driver-pickup-laundromat] Fatal error:', error);
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({
        error: 'Failed to mark order as en route for delivery',
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