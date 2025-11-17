/**
 * Email utility for sending emails via Resend and logging to notifications table
 * Uses React Email for professional templates
 */

import { Resend } from 'resend';
import { render } from '@react-email/render';
import { createClient } from '@supabase/supabase-js';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'updates@notifications.bagsoflaundry.com',
  adminEmail: process.env.YOUR_NOTIFICATION_EMAIL || 'zach@takedetroit.com',
  replyTo: 'support@bagsoflaundry.com'
};

// Type definitions
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
  orderId?: string;
  event?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend and log to notifications table
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, react, html, text, orderId, event } = options;

  try {
    // Validate required fields
    if (!to || !subject) {
      throw new Error('Missing required email fields: to, subject');
    }

    if (!react && !html) {
      throw new Error('Either react or html must be provided');
    }

    // Render React component to HTML if provided
    const emailHtml = react ? render(react) : html;
    const emailText = text || (react ? render(react, { plainText: true }) : undefined);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailHtml,
      text: emailText,
      reply_to: EMAIL_CONFIG.replyTo
    });

    if (error) {
      console.error('[Email] Resend error:', error);

      // Log failed email attempt
      if (orderId && event) {
        await logNotification({
          orderId,
          channel: 'email',
          event,
          payload: {
            to,
            subject,
            error: error.message,
            status: 'failed'
          }
        });
      }

      return {
        success: false,
        error: error.message
      };
    }

    // Log successful email
    if (orderId && event) {
      await logNotification({
        orderId,
        channel: 'email',
        event,
        payload: {
          to,
          subject,
          resend_id: data?.id,
          status: 'sent'
        }
      });
    }

    console.log('[Email] Sent successfully:', {
      to,
      subject,
      resend_id: data?.id
    });

    return {
      success: true,
      id: data?.id
    };

  } catch (error) {
    console.error('[Email] Unexpected error:', error);

    // Log error to notifications if possible
    if (orderId && event) {
      try {
        await logNotification({
          orderId,
          channel: 'email',
          event,
          payload: {
            to,
            subject,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed'
          }
        });
      } catch (logError) {
        console.error('[Email] Failed to log notification:', logError);
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
      console.error('[Email] Failed to log notification:', error);
    }
  } catch (error) {
    console.error('[Email] Exception logging notification:', error);
  }
}

/**
 * Helper function to send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  pickupAddress: string;
  pickupDate: string;
  pickupTimeWindow: string;
  serviceType: string;
  estimatedTotal: number;
  trackingUrl: string;
  react: React.ReactElement;
}): Promise<EmailResult> {
  return sendEmail({
    to: params.to,
    subject: `Order Confirmed - Bags of Laundry #${params.orderNumber}`,
    react: params.react,
    orderId: params.orderId,
    event: 'order_confirmed'
  });
}

/**
 * Helper function to send new order alert to admin
 */
export async function sendNewOrderAlertEmail(params: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  pickupAddress: string;
  pickupDate: string;
  pickupTimeWindow: string;
  serviceType: string;
  notes?: string;
  estimatedTotal: number;
  react: React.ReactElement;
}): Promise<EmailResult> {
  return sendEmail({
    to: EMAIL_CONFIG.adminEmail,
    subject: `🧺 New Order - ${params.customerName} - ${params.pickupDate}`,
    react: params.react,
    orderId: params.orderId,
    event: 'new_order_alert'
  });
}
