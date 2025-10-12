/**
 * Shared payment status enum for consistency across the application
 * Maps to Stripe payment lifecycle and internal order states
 */

export enum PaymentStatus {
  RequiresPayment = 'requires_payment',
  Authorized = 'authorized',
  Paid = 'paid',
  PartiallyRefunded = 'partially_refunded',
  Refunded = 'refunded',
  Failed = 'failed',
  Canceled = 'canceled'
}

/**
 * Helper to check if a payment status indicates a successful payment
 */
export function isPaymentSuccessful(status: PaymentStatus): boolean {
  return [
    PaymentStatus.Paid,
    PaymentStatus.PartiallyRefunded,
    PaymentStatus.Refunded
  ].includes(status);
}

/**
 * Helper to check if a payment can be refunded
 */
export function isRefundable(status: PaymentStatus): boolean {
  return [
    PaymentStatus.Paid,
    PaymentStatus.PartiallyRefunded
  ].includes(status);
}

/**
 * Get user-friendly status description
 */
export function getStatusDescription(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.RequiresPayment:
      return 'Payment Required';
    case PaymentStatus.Authorized:
      return 'Payment Authorized';
    case PaymentStatus.Paid:
      return 'Paid';
    case PaymentStatus.PartiallyRefunded:
      return 'Partially Refunded';
    case PaymentStatus.Refunded:
      return 'Refunded';
    case PaymentStatus.Failed:
      return 'Payment Failed';
    case PaymentStatus.Canceled:
      return 'Canceled';
    default:
      return 'Unknown Status';
  }
}