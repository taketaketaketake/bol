/**
 * Driver Processing Complete Endpoint
 * Marks an order as "ready_for_delivery" after laundry is finished.
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
  import.meta.env.MODE !== 'production' && console.log(`[driver-processing] ${msg}`, data || '');

export const POST: APIRoute = async ({ params, cookies }) => {
  try {
    // 1️⃣ Auth check (admin or driver)
    const { user } = await requireAdmin(cookies);
    const { id: orderId } = params;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 });
    }

    log('Processing-complete request received', { orderId, driverId: user.id });

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
    if (order.status !== 'processing') {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition: ${order.status} → ready_for_delivery`,
          validTransition: 'processing → ready_for_delivery',
        }),
        { status: 400 }
      );
    }

    // 4️⃣ Update order
    const { error: updateError } = await serviceClient
      .from('orders')
      .update({
        status: 'ready_for_delivery',
        ready_for_delivery_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[driver-processing] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), { status: 500 });
    }

    // 5️⃣ Log audit trail
    const { error: auditError } = await serviceClient.from('order_status_history').insert({
      order_id: orderId,
      status: 'ready_for_delivery',
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    });

    if (auditError) {
      console.error('[driver-processing] Audit log error:', auditError);
      // Not fatal — continue
    }

    log('Order marked ready for delivery', { orderId });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: 'ready_for_delivery',
        readyForDeliveryAt: new Date().toISOString(),
        message: 'Order marked as ready for delivery successfully',
      }),
      { status: 200 }
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