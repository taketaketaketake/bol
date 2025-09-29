import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');

  if (!sig || !endpointSecret) {
    console.error('Missing stripe signature or webhook secret');
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(failedPayment);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        await handleSubscriptionPayment(invoice);
        break;

      case 'customer.subscription.created':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('Webhook handled successfully', { status: 200 });

  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
};

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const metadata = paymentIntent.metadata;

  // TODO: Update your database with successful payment
  // - Create order record
  // - Update customer status
  // - Send confirmation email
  // - If membership was included, activate membership

  if (metadata.addMembership === 'true') {
    console.log('Membership included in payment, activating membership...');
    // TODO: Activate membership for customer
  }

  console.log('Order details:', {
    amount: paymentIntent.amount,
    orderType: metadata.orderType,
    customerEmail: metadata.customerEmail,
    pickupAddress: metadata.pickupAddress,
    pickupDate: metadata.pickupDate,
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  // TODO: Handle payment failure
  // - Log the failure
  // - Notify customer
  // - Update order status
}

async function handleSubscriptionPayment(invoice: Stripe.Invoice) {
  console.log('Subscription payment succeeded:', invoice.id);

  // TODO: Handle recurring subscription payments
  // - Extend membership period
  // - Update customer status
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('New subscription created:', subscription.id);

  const customerId = subscription.customer as string;
  const metadata = subscription.metadata;

  // Activate membership benefits
  console.log('Activating membership for customer:', customerId);
  console.log('Membership type:', metadata.membershipType);
  console.log('Signup order amount:', metadata.signupOrderAmount);

  // TODO: Update database with membership status
  // - Set customer as active member
  // - Record membership start date
  // - Apply member pricing for future orders
  // - Send welcome email with membership benefits

  // For now, we'll log the membership activation
  console.log('Membership activated successfully for subscription:', subscription.id);
}