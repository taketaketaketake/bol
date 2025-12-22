import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { getServiceClient } from '../../../../../utils/order-status';
import { ORDER_STATUSES } from '../../../../../db/schema';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate as laundromat staff or admin
    const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);
    
    const orderId = params.id;
    const body = await request.json();
    const { status } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!status || !ORDER_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid status', 
          validStatuses: ORDER_STATUSES 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = getServiceClient();

    // Verify the order belongs to this staff member's laundromat
    const { data: staffRecord } = await serviceClient
      .from('laundromat_staff')
      .select('laundromat_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!staffRecord && !roles.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'No laundromat assignment found' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the order and verify it belongs to this laundromat
    const { data: order } = await serviceClient
      .from('orders')
      .select('id, assigned_laundromat_id, status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!roles.includes('admin') && order.assigned_laundromat_id !== staffRecord.laundromat_id) {
      return new Response(
        JSON.stringify({ error: 'Order not assigned to your laundromat' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the order status
    const updateData: any = { status };
    
    // Set timestamps for specific status changes
    const now = new Date().toISOString();
    switch (status) {
      case 'picked_up':
        updateData.picked_up_at = now;
        break;
      case 'ready_for_delivery':
        updateData.ready_for_delivery_at = now;
        break;
      case 'delivered':
        updateData.delivered_at = now;
        break;
    }

    const { error: updateError } = await serviceClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update order status',
          details: updateError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the status change
    await serviceClient
      .from('order_status_history')
      .insert({
        order_id: orderId,
        status: status,
        changed_by: user.id,
        changed_at: now
      });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        newStatus: status,
        message: `Order status updated to ${status}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating order status:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update order status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};