
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { UsageInfo } from '../types';

const getUserProfileAndUsageFn = httpsCallable<void, UsageInfo>(functions, 'getUserProfileAndUsage');
const createCheckoutSessionFn = httpsCallable<{ priceId?: string }, { sessionId: string; url: string }>(functions, 'createCheckoutSession');
const createPortalSessionFn = httpsCallable<void, { url: string }>(functions, 'createPortalSession');

export async function fetchUserProfileAndUsage(): Promise<UsageInfo> {
  const result = await getUserProfileAndUsageFn();
  return result.data;
}

export async function openCheckout(priceId?: string): Promise<void> {
  const result = await createCheckoutSessionFn({ priceId });
  window.location.href = result.data.url;
}

export async function openBillingPortal(): Promise<void> {
  const result = await createPortalSessionFn();
  window.location.href = result.data.url;
}
