import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import showToast from '../utils/toastUtils';

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

// Module-level singleton flag — script should never be removed once loaded
let scriptLoadPromise = null;
const loadCheckoutScript = () => {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    // If window.Razorpay already exists (e.g. HMR or pre-loaded), resolve immediately
    if (window.Razorpay) { resolve(); return; }
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_URL}"]`);
    if (existing) {
      // Script tag exists but may still be loading
      existing.onload = resolve;
      existing.onerror = reject;
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
};

/**
 * Dynamically loads the Razorpay checkout.js as a module-level singleton.
 * The script is never removed to prevent re-downloads on component remounts.
 */
export const useRazorpay = () => {
  const [scriptReady, setScriptReady] = useState(() => !!window.Razorpay);
  const [processing, setProcessing] = useState(false);
  // Ref for synchronous double-click guard (state updates are async)
  const isProcessingRef = useRef(false);
  // Ref to hold the Razorpay instance so it can be closed on unmount
  const rzpRef = useRef(null);

  useEffect(() => {
    if (!scriptReady) {
      loadCheckoutScript()
        .then(() => setScriptReady(true))
        .catch(() => showToast.error('Failed to load payment module. Please refresh.'));
    }
    // Cleanup: close any open modal if component unmounts mid-payment
    return () => {
      rzpRef.current?.close?.();
    };
  }, [scriptReady]);

  /**
   * Initiates a Razorpay payment flow.
   * @param {{ tier: string, interval: string, userName?: string, userEmail?: string }} options
   * @param {function} onSuccess - Called with { paymentId, orderId, tier, interval }
   * @param {function} onError   - Called with Error
   */
  const initiatePayment = async ({ tier, interval, userName, userEmail }, onSuccess, onError) => {
    if (!scriptReady) {
      showToast.error('Payment module is not ready yet. Please try again.');
      return;
    }
    // Synchronous guard prevents TOCTOU double-click race before state re-render
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setProcessing(true);

    try {
      // Step 1: Create subscription or order (determined server-side)
      const { data: payTarget } = await api.post('/razorpay/order', { tier, interval });

      const isSub = payTarget.type === 'subscription';

      // Step 2: Open Razorpay modal
      const options = {
        key:       payTarget.keyId,
        name:      'Link Snap',
        description: `Pro Plan — ${interval === 'monthly' ? 'Monthly' : interval === 'yearly' ? 'Yearly' : 'One-time'}`,
        prefill: {
          name:  userName  || '',
          email: userEmail || '',
        },
        theme: { color: '#3b82f6' },
        handler: async (response) => {
          // Step 3: Verify signature on backend
          try {
            const verifyPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            };
            if (isSub) {
              verifyPayload.razorpay_subscription_id = response.razorpay_subscription_id;
            } else {
              verifyPayload.razorpay_order_id = response.razorpay_order_id;
            }

            const { data: result } = await api.post('/razorpay/verify', verifyPayload, { timeout: 30000 });
            isProcessingRef.current = false;
            setProcessing(false);
            onSuccess?.({ 
              paymentId: result.paymentId, 
              id: isSub ? response.razorpay_subscription_id : response.razorpay_order_id, 
              tier, 
              interval 
            });
          } catch (verifyErr) {
            isProcessingRef.current = false;
            setProcessing(false);
            const isPotentiallyPaid = !verifyErr.response || verifyErr.response?.status >= 500;
            const msg = isPotentiallyPaid
              ? `Payment received but verification pending. Please contact support with Payment ID: ${response.razorpay_payment_id}`
              : (verifyErr.response?.data?.message || 'Payment verification failed. Please try again.');
            onError?.(new Error(msg));
          }
        },
        modal: {
          ondismiss: () => {
            isProcessingRef.current = false;
            setProcessing(false);
            onError?.(new Error('Payment cancelled'));
          },
        },
      };

      if (isSub) {
        options.subscription_id = payTarget.subscriptionId;
      } else {
        options.amount = payTarget.amount;
        options.currency = payTarget.currency;
        options.order_id = payTarget.orderId;
      }

      rzpRef.current = new window.Razorpay(options);
      rzpRef.current.on('payment.failed', (response) => {
        isProcessingRef.current = false;
        setProcessing(false);
        onError?.(new Error(response.error?.description || 'Payment failed'));
      });
      rzpRef.current.open();
    } catch (err) {
      isProcessingRef.current = false;
      setProcessing(false);
      onError?.(err);
    }
  };

  return { initiatePayment, processing, scriptReady };
};
