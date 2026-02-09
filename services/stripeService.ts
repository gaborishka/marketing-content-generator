
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { UsageInfo } from '../types';

const getUserProfileAndUsageFn = httpsCallable<void, UsageInfo>(functions, 'getUserProfileAndUsage');
const createCheckoutSessionFn = httpsCallable<
  { interval?: 'monthly' | 'yearly'; returnUrl?: string },
  { sessionId: string; url: string }
>(functions, 'createCheckoutSession');
const createPortalSessionFn = httpsCallable<
  { returnUrl?: string },
  { url: string }
>(functions, 'createPortalSession');

function getCurrentReturnUrl(): string {
  return window.location.origin + window.location.pathname + '#/settings';
}

export async function fetchUserProfileAndUsage(): Promise<UsageInfo> {
  const result = await getUserProfileAndUsageFn();
  return result.data;
}

export async function openCheckout(interval?: 'monthly' | 'yearly'): Promise<void> {
  const returnUrl = getCurrentReturnUrl();
  const result = await createCheckoutSessionFn({ interval, returnUrl });
  if (!result.data.url) {
    throw new Error('No checkout URL returned from Stripe.');
  }
  window.location.href = result.data.url;
}

export async function openBillingPortal(): Promise<void> {
  const returnUrl = getCurrentReturnUrl();
  const result = await createPortalSessionFn({ returnUrl });
  if (!result.data.url) {
    throw new Error('No portal URL returned from Stripe.');
  }
  window.location.href = result.data.url;
}
