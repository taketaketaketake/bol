/**
 * SMS utility for sending text messages via Telnyx and logging to notifications table
 */

import Telnyx from 'telnyx';
import { createClient } from '@supabase/supabase-js';

// Initialize Telnyx client
const telnyx = new Telnyx({
  apiKey: process.env.TELNYX_API_KEY || ''
});

// Service client for logging notifications
const getServiceClient = () => {
  if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

// SMS configuration
export const SMS_CONFIG = {
  from: process.env.TELNYX_FROM_NUMBER || '',
  optOutMessage: '\n\nReply STOP to unsubscribe'
};

// Type definitions
export interface SendSMSOptions {
  to: string;
  message: string;
  orderId?: string;
  event?: string;
}

export interface SMSResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Add +1 if not present (assuming US numbers)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If already formatted correctly
  if (phone.startsWith('+')) {
    return phone;
  }

  return `+${digits}`;
}

/**
 * Send an SMS via Telnyx and log to notifications table
 */
export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  const { to, message, orderId, event } = options;

  try {
    // Validate required fields
    if (!to || !message) {
      throw new Error('Missing required SMS fields: to, message');
    }

    if (!SMS_CONFIG.from) {
      throw new Error('TELNYX_FROM_NUMBER not configured');
    }

    if (!process.env.TELNYX_API_KEY) {
      throw new Error('TELNYX_API_KEY not configured');
    }

    // Format phone numbers
    const formattedTo = formatPhoneNumber(to);
    const formattedFrom = formatPhoneNumber(SMS_CONFIG.from);

    // Add opt-out message to comply with TCPA
    const fullMessage = message + SMS_CONFIG.optOutMessage;

    // Validate message length (SMS standard is 160 chars, but concatenated messages supported)
    if (fullMessage.length > 1600) {
      throw new Error('SMS message too long (max 1600 characters)');
    }

    // Send SMS via Telnyx
    const response = await telnyx.messages.create({
      from: formattedFrom,
      to: formattedTo,
      text: fullMessage,
    });

    // Log successful SMS
    if (orderId && event) {
      await logNotification({
        orderId,
        channel: 'sms',
        event,
        payload: {
          to: formattedTo,
          message: fullMessage,
          telnyx_id: response.data.id,
          status: 'sent'
        }
      });
    }

    console.log('[SMS] Sent successfully:', {
      to: formattedTo,
      telnyx_id: response.data.id
    });

    return {
      success: true,
      id: response.data.id
    };

  } catch (error) {
    console.error('[SMS] Unexpected error:', error);

    // Log error to notifications if possible
    if (orderId && event) {
      try {
        await logNotification({
          orderId,
          channel: 'sms',
          event,
          payload: {
            to,
            message,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          }
        });
      } catch (logError) {
        console.error('[SMS] Failed to log notification:', logError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Log notification to database
 */
async function logNotification(params: {
  orderId: string;
  channel: string;
  event: string;
  payload: Record<string, any>;
}): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { error } = await supabase
      .from('notifications')
      .insert({
        order_id: params.orderId,
        channel: params.channel,
        event: params.event,
        payload: params.payload,
        sent_at: new Date().toISOString()
      });

    if (error) {
      console.error('[SMS] Failed to log notification:', error);
    }
  } catch (error) {
    console.error('[SMS] Exception logging notification:', error);
  }
}

/**
 * Helper function to send order confirmation SMS to customer
 */
export async function sendOrderConfirmationSMS(params: {
  to: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  pickupDate: string;
  pickupTimeWindow: string;
}): Promise<SMSResult> {
  const message = `Hi ${params.customerName}! Your Bags of Laundry order #${params.orderNumber} is confirmed.\n\nPickup: ${params.pickupDate}, ${params.pickupTimeWindow}\n\nWe'll text you when we're on the way!`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'order_confirmed'
  });
}

/**
 * Helper function to send en route to pickup SMS
 */
export async function sendEnRoutePickupSMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  estimatedArrival: string;
}): Promise<SMSResult> {
  const message = `Hi ${params.customerName}! We're on our way to pick up your laundry. ETA: ${params.estimatedArrival}. See you soon! 🧺`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'en_route_pickup'
  });
}

/**
 * Helper function to send pickup complete SMS
 */
export async function sendPickupCompleteSMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  weight?: number;
  finalAmount?: number;
}): Promise<SMSResult> {
  let message = `Hi ${params.customerName}! We've picked up your laundry.`;

  if (params.weight && params.finalAmount) {
    message += ` Weight: ${params.weight} lbs, Total: $${params.finalAmount.toFixed(2)}.`;
  }

  message += ` We'll have it cleaned and ready for delivery soon!`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'pickup_complete'
  });
}

/**
 * Helper function to send ready for delivery SMS
 */
export async function sendReadyForDeliverySMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  estimatedDelivery?: string;
}): Promise<SMSResult> {
  let message = `Hi ${params.customerName}! Your laundry is clean and ready for delivery! ✨`;

  if (params.estimatedDelivery) {
    message += ` Expected delivery: ${params.estimatedDelivery}.`;
  }

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'ready_for_delivery'
  });
}

/**
 * Helper function to send en route to delivery SMS
 */
export async function sendEnRouteDeliverySMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  estimatedArrival: string;
}): Promise<SMSResult> {
  const message = `Hi ${params.customerName}! We're on our way with your clean laundry! ETA: ${params.estimatedArrival}. 🚗`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'en_route_delivery'
  });
}

/**
 * Helper function to send delivery complete SMS
 */
export async function sendDeliveryCompleteSMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  orderNumber: string;
}): Promise<SMSResult> {
  const message = `Hi ${params.customerName}! Your laundry has been delivered. Thanks for choosing Bags of Laundry! 🧺\n\nOrder #${params.orderNumber}`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'delivery_complete'
  });
}

/**
 * Helper function to send payment failed SMS
 */
export async function sendPaymentFailedSMS(params: {
  to: string;
  orderId: string;
  customerName: string;
  orderNumber: string;
}): Promise<SMSResult> {
  const message = `Hi ${params.customerName}, there was an issue processing payment for order #${params.orderNumber}. Please update your payment method at bagsoflaundry.com/orders`;

  return sendSMS({
    to: params.to,
    message,
    orderId: params.orderId,
    event: 'payment_failed'
  });
}
