import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { HCaptchaWidget } from './HCaptchaWidget';

/**
 * Stripe publishable key from environment.
 * Required env var: VITE_STRIPE_PUBLISHABLE_KEY (pk_test_... or pk_live_...)
 */
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    'pk_live_51Ser661sf59ISJ4cbV3XzDIxnQfUBZHH5m7vKJnHKCbkBMos89eCFRBG6O7m61PC8kkNumzYwSECVtFjhx3uLUGL00Pnn1wK2u',
);

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  submitLabel?: string;
  captchaToken: string | null;
  onCaptchaVerify: (token: string) => void;
  onCaptchaExpire: () => void;
}

/**
 * Inner payment form that uses the Stripe hooks.
 * Must be rendered inside an <Elements> provider.
 *
 * Uses PaymentElement which renders all payment methods enabled in the
 * Stripe Dashboard: card, Apple Pay, Google Pay, Venmo, PayPal, Cash App,
 * Klarna, Affirm, Afterpay, and Link.
 */
function PaymentForm({
  clientSecret,
  onSuccess,
  onError,
  submitLabel,
  captchaToken,
  onCaptchaVerify,
  onCaptchaExpire,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  const captchaRequired = !!import.meta.env.VITE_HCAPTCHA_SITE_KEY;
  const captchaPassed = !captchaRequired || !!captchaToken;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      if (captchaRequired && !captchaToken) {
        onError('Please complete the CAPTCHA verification');
        return;
      }

      setProcessing(true);

      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href,
          },
          redirect: 'if_required',
        });

        if (error) {
          onError(error.message ?? 'Payment failed. Please try again.');
        } else {
          onSuccess();
        }
      } catch (err: any) {
        onError(err.message ?? 'An unexpected error occurred.');
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, clientSecret, captchaToken, onSuccess, onError],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* CAPTCHA Widget */}
      <HCaptchaWidget
        onVerify={onCaptchaVerify}
        onExpire={onCaptchaExpire}
        onError={(err) => onError(`CAPTCHA error: ${err}`)}
      />

      {/* Payment input — card, Apple Pay, Google Pay, Link */}
      <PaymentElement
        options={{
          layout: 'accordion',
          paymentMethodOrder: [
            'apple_pay', 'google_pay', 'venmo', 'paypal', 'cashapp',
            'klarna', 'affirm', 'afterpay_clearpay',
            'card',
          ],
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
        onReady={() => setReady(true)}
      />

      {/* Submit button */}
      <button
        type="submit"
        disabled={!stripe || processing || !ready || !captchaPassed}
        className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm tracking-wide uppercase"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              aria-hidden="true"
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

      {captchaRequired && !captchaToken && (
        <p className="text-center text-amber-400 text-xs">
          Please complete the CAPTCHA to continue
        </p>
      )}

      {/* Stripe badge */}
      <p className="text-center text-gray-400 text-xs">
        Secured by Stripe. Your payment details never touch our servers.
      </p>
    </form>
  );
}

export interface StripeCheckoutWithCaptchaProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  title?: string;
  description?: string;
  onCaptchaVerify: (token: string) => void;
}

/**
 * StripeCheckout wraps the Stripe Elements provider and PaymentForm.
 * Pass a `clientSecret` from a PaymentIntent created on the backend.
 *
 * Styled to match the Concert Poster Noir design system.
 * Includes hCaptcha for bot protection.
 */
export default function StripeCheckoutWithCaptcha({
  clientSecret,
  onSuccess,
  onError,
  onCancel,
  submitLabel,
  title,
  description,
  onCaptchaVerify,
}: StripeCheckoutWithCaptchaProps) {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
    onCaptchaVerify(token);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
  };

  return (
    <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 animate-fade-in">
      {title && (
        <h3 className="font-display text-lg tracking-wider text-warm-50 mb-1">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-400 mb-5 font-body">{description}</p>
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
          captchaToken={captchaToken}
          onCaptchaVerify={handleCaptchaVerify}
          onCaptchaExpire={handleCaptchaExpire}
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
