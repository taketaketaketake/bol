import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { getServiceClient } from '../../../../../utils/order-status';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    // Authenticate as laundromat staff or admin
    const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);
    
    const orderId = params.id;
    const body = await request.json();
    const { weight } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!weight || isNaN(weight) || weight <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid weight is required (must be > 0)' }),
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
      .select('id, assigned_laundromat_id, measured_weight_lb, customer_id')
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

    const previousWeight = order.measured_weight_lb;
    const weightChange = weight - (previousWeight || 0);

    // Update the order weight
    const { error: updateError } = await serviceClient
      .from('orders')
      .update({ 
        measured_weight_lb: weight,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update order weight',
          details: updateError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: If this is a significant change, trigger payment adjustment
    // This would typically involve updating Stripe payment intents
    if (Math.abs(weightChange) > 0.5) { // 0.5 lb threshold
      console.log(`Weight change of ${weightChange} lbs for order ${orderId} - payment adjustment may be needed`);
      // In a real implementation, you'd call Stripe API here
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        previousWeight: previousWeight || 0,
        newWeight: weight,
        weightChange,
        message: `Order weight updated to ${weight} lbs`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating order weight:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update order weight',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};