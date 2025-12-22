import type { APIRoute } from 'astro';
import { requireRole } from '../../../../../utils/require-role';
import { getServiceClient } from '../../../../../utils/order-status';
import { STANDARD_RATE } from '../../../../../utils/pricing';
import { rateLimit, RATE_LIMITS } from '../../../../../utils/rate-limit';

// Message templates for quick communication
const MESSAGE_TEMPLATES = {
  pickup_reminder: "Hi! This is {laundromat_name}. We're on our way to pick up your laundry for order #{order_id}. Please have your items ready!",
  pickup_complete: "Great! We've picked up your laundry (Order #{order_id}). We'll have it cleaned and ready for delivery soon.",
  processing_update: "Your laundry (Order #{order_id}) is currently being processed. We'll notify you when it's ready for delivery!",
  processing_complete: "Good news! Your laundry (Order #{order_id}) is clean and ready for delivery. We'll be in touch about delivery timing.",
  delivery_eta: "Your clean laundry (Order #{order_id}) will be delivered within the next 2 hours. Thank you for choosing {laundromat_name}!",
  delivery_complete: "Your laundry has been delivered! Thank you for using {laundromat_name}. Order #{order_id} is now complete.",
  delay_notification: "We apologize for the delay with your order #{order_id}. We're working to get your laundry ready as soon as possible.",
  weight_update: "We've measured your laundry at {weight} lbs for order #{order_id}. Your updated total is ${total}."
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
  // Apply general rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.GENERAL);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate as laundromat staff or admin
    const { user, roles } = await requireRole(cookies, ['laundromat_staff', 'admin']);
    
    const orderId = params.id;
    const body = await request.json();
    const { messageType, customMessage, phoneNumber } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = getServiceClient();

    // Verify the order belongs to this staff member's laundromat
    const { data: staffRecord } = await serviceClient
      .from('laundromat_staff')
      .select(`
        laundromat_id,
        laundromats (
          id,
          name
        )
      `)
      .eq('auth_user_id', user.id)
      .single();

    if (!staffRecord && !roles.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'No laundromat assignment found' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the order and customer information
    const { data: order } = await serviceClient
      .from('orders')
      .select(`
        id,
        assigned_laundromat_id,
        measured_weight_lb,
        customer:customers (
          full_name,
          phone,
          sms_opt_in
        )
      `)
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

    // Determine the target phone number
    const targetPhone = phoneNumber || order.customer?.phone;
    
    if (!targetPhone) {
      return new Response(
        JSON.stringify({ error: 'No phone number available for this customer' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer has opted into SMS
    if (!order.customer?.sms_opt_in && !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Customer has not opted into SMS notifications' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let messageText: string;

    if (customMessage) {
      messageText = customMessage;
    } else if (messageType && MESSAGE_TEMPLATES[messageType as keyof typeof MESSAGE_TEMPLATES]) {
      messageText = MESSAGE_TEMPLATES[messageType as keyof typeof MESSAGE_TEMPLATES];
      
      // Replace template variables
      messageText = messageText
        .replace(/{laundromat_name}/g, staffRecord?.laundromats.name || 'Bags of Laundry')
        .replace(/{order_id}/g, order.id.slice(-8))
        .replace(/{weight}/g, (order.measured_weight_lb || 0).toString())
        .replace(/{total}/g, calculateOrderTotal(order.measured_weight_lb || 0).toFixed(2));
    } else {
      return new Response(
        JSON.stringify({ 
          error: 'Either customMessage or valid messageType is required',
          availableTemplates: Object.keys(MESSAGE_TEMPLATES)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send the SMS (this would integrate with your SMS provider)
    const smsResult = await sendSMSMessage(targetPhone, messageText, orderId);

    if (!smsResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send SMS',
          details: smsResult.error 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the message in notifications table
    await serviceClient
      .from('notifications')
      .insert({
        order_id: orderId,
        channel: 'sms',
        event: messageType || 'custom_message',
        payload: {
          phone: targetPhone,
          message: messageText,
          sent_by: user.id
        },
        sent_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        messageType: messageType || 'custom',
        sentTo: targetPhone,
        message: messageText,
        smsId: smsResult.messageId
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending message:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * Send SMS message using your SMS provider
 * This is a placeholder - implement with your actual SMS service
 */
async function sendSMSMessage(
  phone: string, 
  message: string, 
  orderId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // TODO: Implement actual SMS sending with your provider (Twilio, etc.)
  
  // For now, just log the message (in production, this would send via SMS API)
  console.log(`SMS to ${phone} for order ${orderId}: ${message}`);
  
  // Simulate success
  return {
    success: true,
    messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  /* Example Twilio implementation:
  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    return {
      success: true,
      messageId: response.sid
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS send failed'
    };
  }
  */
}

/**
 * Calculate order total based on weight
 * This is a simplified calculation - in production you'd consider service type, membership, etc.
 */
function calculateOrderTotal(weight: number): number {
  const basePricePerPound = STANDARD_RATE; // $2.25/lb
  return weight * basePricePerPound;
}

// GET endpoint to retrieve available message templates
export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Authenticate as laundromat staff or admin
    await requireRole(cookies, ['laundromat_staff', 'admin']);
    
    return new Response(
      JSON.stringify({
        templates: Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => ({
          key,
          template,
          preview: template.length > 100 ? template.substring(0, 100) + '...' : template
        }))
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve templates' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};