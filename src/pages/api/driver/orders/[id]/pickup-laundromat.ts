/**
 * Driver Pickup from Laundromat Endpoint
 * Marks an order as "en_route_delivery" when driver collects from laundromat.
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../../../../utils/require-roles';

const serviceClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-pickup-laundromat] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, cookies }) => {
  try {
    // 1️⃣ Auth check (admin or driver)
    const { user } = await requireAdmin(cookies);
    const { id: orderId } = params;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 });
    }

    log('Pickup from laundromat request received', { orderId, driverId: user.id });

    // 2️⃣ Retrieve order
    const { data: order, error: fetchError } = await serviceClient
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    // 3️⃣ Validate transition
    if (order.status !== 'ready_for_delivery') {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition: ${order.status} → en_route_delivery`,
          validTransition: 'ready_for_delivery → en_route_delivery',
        }),
        { status: 400 }
      );
    }

    const enRouteAt = new Date().toISOString();

    // 4️⃣ Update order (skip updated_at since we have trigger)
    const { error: updateError } = await serviceClient
      .from('orders')
      .update({
        status: 'en_route_delivery',
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[driver-pickup-laundromat] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), { status: 500 });
    }

    // 5️⃣ Log audit trail
    const { error: auditError } = await serviceClient.from('order_status_history').insert({
      order_id: orderId,
      status: 'en_route_delivery',
      changed_by: user.id,
      changed_at: enRouteAt,
    });

    if (auditError) {
      console.error('[driver-pickup-laundromat] Audit log error:', auditError);
      // Not fatal — continue
    }

    log('Order marked as en route for delivery', { orderId });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: 'en_route_delivery',
        enRouteAt,
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