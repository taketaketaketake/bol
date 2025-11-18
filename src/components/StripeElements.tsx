import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface PaymentFormProps {
  amount: number;
  addMembership: boolean;
  orderDetails: any;
  onPaymentError: (error: string) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  addMembership,
  orderDetails,
  onPaymentError
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [currentAmount, setCurrentAmount] = useState(amount);
  const [membershipSelected, setMembershipSelected] = useState(addMembership);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState('');

  useEffect(() => {
    // Create order and payment intent when component mounts
    createOrderAndPaymentIntent();
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    // Listen for membership toggle events from the parent page
    const handleMembershipToggle = (event: CustomEvent) => {
      const { addMembership: newMembership, newAmount } = event.detail;
      setMembershipSelected(newMembership);
      setCurrentAmount(newAmount);
    };

    window.addEventListener('membershipToggled', handleMembershipToggle as EventListener);

    return () => {
      window.removeEventListener('membershipToggled', handleMembershipToggle as EventListener);
    };
  }, []);

  const createOrderAndPaymentIntent = async () => {
    try {
      // Step 1: Create the order first
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: orderDetails.customerName,
          customerEmail: orderDetails.customerEmail,
          customerPhone: orderDetails.customerPhone || '',
          orderType: orderDetails.orderType,
          planType: orderDetails.planType || orderDetails.orderType,
          serviceType: orderDetails.serviceType || 'wash_fold',
          pickupDate: orderDetails.pickupDate,
          pickupTimeWindowId: orderDetails.pickupTimeWindowId,
          pickupAddress: orderDetails.pickupAddress,
          notes: orderDetails.notes,
          preferences: orderDetails.preferences,
          addons: orderDetails.addons,
          addonPrefs: orderDetails.addonPrefs,
          estimatedAmount: currentAmount,
          authUserId: orderDetails.authUserId || null
        }),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('[StripeElements] Order creation failed:', {
          status: orderResponse.status,
          statusText: orderResponse.statusText,
          body: errorText
        });

        try {
          const errorData = JSON.parse(errorText);
          const errorMessage = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || 'Failed to create order';
          if (typeof onPaymentError === 'function') {
            onPaymentError(errorMessage);
          }
        } catch (e) {
          if (typeof onPaymentError === 'function') {
            onPaymentError(`Failed to create order: ${orderResponse.status} ${errorText}`);
          }
        }
        return;
      }

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        console.error('[StripeElements] Order creation failed:', orderData);
        if (typeof onPaymentError === 'function') {
          onPaymentError(orderData.error || 'Failed to create order');
        }
        return;
      }

      // Store order ID for redirect after successful payment
      const createdOrderId = orderData.orderId;
      setOrderId(createdOrderId);
      console.log('[StripeElements] Order created:', createdOrderId);

      // Step 2: Create payment intent for the order
      const paymentResponse = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: currentAmount,
          addMembership: membershipSelected,
          orderDetails: {
            ...orderDetails,
            orderId: createdOrderId
          }
        }),
      });

      const paymentData = await paymentResponse.json();

      if (paymentData.error) {
        if (typeof onPaymentError === 'function') {
          onPaymentError(paymentData.error);
        }
        return;
      }

      setClientSecret(paymentData.clientSecret);

      // Store additional data for subscription handling
      if (paymentData.membershipIncluded) {
        // Store subscription info for later use
        (window as any).subscriptionData = {
          customerId: paymentData.customerId,
          subscriptionId: paymentData.subscriptionId,
          orderAmount: paymentData.orderAmount,
          savings: paymentData.savings
        };
      }
    } catch (error) {
      console.error('[StripeElements] Error initializing payment:', error);
      if (typeof onPaymentError === 'function') {
        onPaymentError('Failed to initialize payment');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);

    const cardNumber = elements.getElement(CardNumberElement);

    if (!cardNumber) {
      setLoading(false);
      return;
    }

    // Sanitize cardholder name
    const sanitizedName = cardholderName
      .trim()
      .replace(/[^a-zA-Z\s\-'\.]/g, '')
      .substring(0, 50);

    if (membershipSelected) {
      // For subscription payments, use confirmPayment
      // Note: Stripe handles the redirect for subscriptions requiring additional actions
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}`, // Redirect to order detail
        },
        redirect: 'if_required',
      });

      setLoading(false);

      if (result.error) {
        if (typeof onPaymentError === 'function') {
          onPaymentError(result.error.message || 'Payment failed');
        }
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        // Subscription payment succeeded
        console.log('[StripeElements] Subscription payment succeeded');
        
        // Redirect to order detail page
        if (orderId) {
          console.log('[StripeElements] Redirecting to order page:', orderId);
          window.location.href = `/orders/${orderId}`;
        } else {
          console.error('[StripeElements] No order ID available for redirect');
          window.location.href = '/dashboard?error=order-not-found';
        }
      }
    } else {
      // For regular payments, use confirmCardPayment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: sanitizedName || orderDetails.customerName,
            email: orderDetails.customerEmail,
          },
        }
      });

      setLoading(false);

      console.log('[StripeElements] Payment result:', result);

      if (result.error) {
        console.error('[StripeElements] Stripe payment error:', result.error);
        if (typeof onPaymentError === 'function') {
          onPaymentError(result.error.message || 'Payment failed');
        }
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        console.log('[StripeElements] Payment succeeded!', result.paymentIntent);
        
        // Redirect to order detail page using the orderId from state
        if (orderId) {
          console.log('[StripeElements] Redirecting to order page:', orderId);
          window.location.href = `/orders/${orderId}`;
        } else {
          console.error('[StripeElements] No order ID available for redirect');
          // Fallback to dashboard with error message
          window.location.href = '/dashboard?error=order-not-found';
        }
      } else {
        console.error('[StripeElements] Unknown payment result:', result);
        if (typeof onPaymentError === 'function') {
          onPaymentError('Payment failed - please try again');
        }
      }
    }
  };

  const stripeElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
      invalid: {
        color: '#ef4444',
      },
      complete: {
        color: '#10b981',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cardholder Name */}
      <div>
        <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-2">
          Cardholder Name
        </label>
        <input
          type="text"
          id="cardholderName"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="John Doe"
          autoComplete="cc-name"
          maxLength={50}
          pattern="[a-zA-Z\s\-'\.]*"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
          required
        />
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Number
        </label>
        <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all bg-white">
          <CardNumberElement options={stripeElementOptions} />
        </div>
      </div>

      {/* Expiry and CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date
          </label>
          <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all bg-white">
            <CardExpiryElement options={stripeElementOptions} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CVC
          </label>
          <div className="w-full px-4 py-3 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all bg-white">
            <CardCvcElement options={stripeElementOptions} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || !clientSecret || loading}
        className={`w-full px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
        } text-white`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing Payment...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {membershipSelected ? 'Pay & Join Membership' : 'Complete Payment'}
          </>
        )}
      </button>

      <div className="text-xs text-gray-500 text-center">
        Your payment is secured by Stripe. We never store your card details.
      </div>
    </form>
  );
};

interface StripeElementsProps {
  amount: number;
  addMembership: boolean;
  orderDetails: any;
  onPaymentError: (error: string) => void;
}

const StripeElements: React.FC<StripeElementsProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
};

export default StripeElements;