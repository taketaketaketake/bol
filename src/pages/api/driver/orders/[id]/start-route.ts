/**
 * Driver Start Route Endpoint
 * Updates order status from 'scheduled' to 'en_route_pickup'
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { updateOrderStatus } from '../../../../../utils/order-status';

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-start-route] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, cookies }) => {
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

    log('Start route request received', { orderId, driverId: user.id });

    // Update order status using centralized utility
    const result = await updateOrderStatus({
      orderId,
      newStatus: 'en_route_pickup',
      userId: user.id,
      additionalData: {
        driver_id: user.id // Ensure driver is tracked
      }
    });

    if (!result.success) {
      log('Status update failed:', { orderId, error: result.error });
      return new Response(
        JSON.stringify({
          error: result.error || 'Failed to update order status',
          validTransition: result.validTransition
        }),
        { 
          status: result.error?.includes('not found') ? 404 : 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    log('Order marked as en route for pickup', { orderId });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: result.status,
        enRouteAt: result.updatedAt,
        updatedAt: result.updatedAt,
        driverId: user.id,
        message: 'Driver started route - en route to pickup',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[driver-start-route] Fatal error:', error);
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({
        error: 'Failed to start route',
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