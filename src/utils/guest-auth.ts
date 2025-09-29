// Guest authentication utilities

/**
 * Generate a secure access token for guest orders
 */
export function generateAccessToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

/**
 * Generate expiration date for access tokens (14 days from now)
 */
export function generateTokenExpiration(): Date {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
}

/**
 * Check if a token is still valid
 */
export function isTokenValid(expiresAt: string | Date): boolean {
  const expiration = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiration > new Date();
}

/**
 * Generate magic link for order access
 */
export function generateMagicLink(orderId: string, token: string, baseUrl: string): string {
  return `${baseUrl}/orders/${orderId}?token=${token}`;
}

/**
 * Email template for order confirmation with magic link
 */
export function getOrderConfirmationEmail(
  customerName: string,
  orderId: string,
  magicLink: string,
  orderTotal: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - Bags of Laundry</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e7eb; }
        .logo { font-size: 24px; font-weight: bold; color: #1f2937; }
        .content { padding: 30px 0; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        .order-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🧺 Bags of Laundry</div>
        </div>

        <div class="content">
          <h1>Thanks for your order${customerName ? `, ${customerName}` : ''}!</h1>

          <p>We've received your laundry order and will be in touch soon with pickup details.</p>

          <div class="order-details">
            <h3>Order Summary</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Total:</strong> ${orderTotal}</p>
          </div>

          <p>You can view your order status and details anytime using the link below:</p>

          <p style="text-align: center;">
            <a href="${magicLink}" class="button">View Your Order</a>
          </p>

          <p><small>This link is valid for 14 days and provides secure access to your order. You can bookmark it for easy access.</small></p>
        </div>

        <div class="footer">
          <p>Questions? Reply to this email or call us at (555) 123-4567</p>
          <p>Bags of Laundry • Detroit, MI</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Simple email sender (placeholder - replace with your email service)
 */
export async function sendOrderConfirmationEmail(
  to: string,
  customerName: string,
  orderId: string,
  magicLink: string,
  orderTotal: string
): Promise<boolean> {
  try {
    const emailHtml = getOrderConfirmationEmail(customerName, orderId, magicLink, orderTotal);

    // TODO: Replace with actual email service (SendGrid, Mailgun, etc.)
    console.log('📧 Order confirmation email would be sent to:', to);
    console.log('🔗 Magic link:', magicLink);
    console.log('📄 Email content:', emailHtml);

    // For now, just log the email content
    // In production, implement actual email sending:
    // await emailService.send({
    //   to,
    //   subject: `Order Confirmation #${orderId} - Bags of Laundry`,
    //   html: emailHtml
    // });

    return true;
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    return false;
  }
}