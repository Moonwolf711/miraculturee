import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

/**
 * Stripe publishable key from environment.
 * Required env var: VITE_STRIPE_PUBLISHABLE_KEY (pk_test_... or pk_live_...)
 */
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
);

/** Style overrides for the Stripe CardElement to match Concert Poster Noir theme */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#e5e5e5',
      fontFamily: '"Outfit", sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#525252',
      },
      iconColor: '#f59e0b',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  submitLabel?: string;
}

/**
 * Inner payment form that uses the Stripe hooks.
 * Must be rendered inside an <Elements> provider.
 */
function PaymentForm({ clientSecret, onSuccess, onError, submitLabel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        onError('Card element not found');
        return;
      }

      setProcessing(true);

      try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement },
        });

        if (error) {
          onError(error.message ?? 'Payment failed. Please try again.');
        } else if (paymentIntent?.status === 'succeeded') {
          onSuccess();
        } else {
          // Payment is still processing (e.g. 3D Secure)
          onError('Payment is still processing. Please wait a moment.');
        }
      } catch (err: any) {
        onError(err.message ?? 'An unexpected error occurred.');
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, clientSecret, onSuccess, onError],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Card input */}
      <div className="bg-noir-900 border border-noir-700 rounded-lg px-4 py-3.5 transition-colors focus-within:border-amber-500/50">
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onChange={(e) => setCardComplete(e.complete)}
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!stripe || processing || !cardComplete}
        className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm tracking-wide uppercase"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          submitLabel ?? 'Pay Now'
        )}
      </button>

      {/* Stripe badge */}
      <p className="text-center text-gray-600 text-xs">
        Secured by Stripe. Your card details never touch our servers.
      </p>
    </form>
  );
}

export interface StripeCheckoutProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  title?: string;
  description?: string;
}

/**
 * StripeCheckout wraps the Stripe Elements provider and PaymentForm.
 * Pass a `clientSecret` from a PaymentIntent created on the backend.
 *
 * Styled to match the Concert Poster Noir design system.
 */
export default function StripeCheckout({
  clientSecret,
  onSuccess,
  onError,
  onCancel,
  submitLabel,
  title,
  description,
}: StripeCheckoutProps) {
  return (
    <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 animate-fade-in">
      {title && (
        <h3 className="font-display text-lg tracking-wider text-warm-50 mb-1">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-500 mb-5 font-body">{description}</p>
      )}

      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#f59e0b',
              colorBackground: '#0f0f0f',
              colorText: '#e5e5e5',
              colorDanger: '#ef4444',
              fontFamily: '"Outfit", sans-serif',
              borderRadius: '8px',
            },
          },
        }}
      >
        <PaymentForm
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onError={onError}
          submitLabel={submitLabel}
        />
      </Elements>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-3 px-6 py-2.5 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600 font-medium rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
