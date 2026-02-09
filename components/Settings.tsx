
import React, { useState, useEffect } from 'react';
import { Crown, Zap, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { UsageInfo } from '../types';
import { openCheckout, openBillingPortal } from '../services/stripeService';

interface SettingsProps {
  usageInfo: UsageInfo | null;
  onRefreshUsage: () => void;
}

const FREE_FEATURES = [
  '10 generations per day',
  'All channels supported',
  'Basic compliance checking',
  'Canvas workspace',
];

const PRO_FEATURES = [
  '100 generations per day',
  'All channels supported',
  'Advanced compliance with retries',
  'Canvas workspace',
  'Priority support',
  'Image & video generation',
];

export const Settings: React.FC<SettingsProps> = ({ usageInfo, onRefreshUsage }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const billing = searchParams.get('billing');
  useEffect(() => {
    if (billing === 'success') {
      setToast({ message: 'Subscription activated! Welcome to Pro.', type: 'success' });
      onRefreshUsage();
      setSearchParams((prev) => { prev.delete('billing'); return prev; }, { replace: true });
    } else if (billing === 'canceled') {
      setToast({ message: 'Checkout canceled. No changes were made.', type: 'info' });
      setSearchParams((prev) => { prev.delete('billing'); return prev; }, { replace: true });
    }
  }, [billing, setSearchParams, onRefreshUsage]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      await openCheckout();
    } catch {
      setToast({ message: 'Failed to start checkout. Please try again.', type: 'info' });
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      await openBillingPortal();
    } catch {
      setToast({ message: 'Failed to open billing portal. Please try again.', type: 'info' });
      setPortalLoading(false);
    }
  };

  const isPro = usageInfo?.tier === 'pro';
  const usagePercent = usageInfo && usageInfo.limit > 0
    ? Math.min(100, (usageInfo.generationCount / usageInfo.limit) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">Manage your subscription and usage</p>

      {toast && (
        <div className={`mb-6 p-4 rounded-lg border text-sm flex items-center ${
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toast.type === 'success' ? <Check size={16} className="mr-2 shrink-0" /> : <Zap size={16} className="mr-2 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Usage Stats */}
      {usageInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Today's Usage</h2>
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold text-slate-900">{usageInfo.generationCount}</span>
            <span className="text-sm text-slate-500">of {usageInfo.limit} generations</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                usagePercent >= 100
                  ? 'bg-red-500'
                  : usagePercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">Resets daily at midnight UTC</p>
        </div>
      )}

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className={`bg-white rounded-xl border-2 p-6 ${
          !isPro ? 'border-slate-300 ring-2 ring-slate-200' : 'border-slate-200'
        }`}>
          {!isPro && (
            <span className="inline-block text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded mb-3">
              Current Plan
            </span>
          )}
          <h3 className="text-xl font-bold text-slate-900 mb-1">Free</h3>
          <p className="text-3xl font-bold text-slate-900 mb-4">$0<span className="text-sm font-normal text-slate-500">/month</span></p>
          <ul className="space-y-2 mb-6">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center text-sm text-slate-600">
                <Check size={16} className="mr-2 text-slate-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {!isPro && (
            <div className="text-sm text-slate-400 text-center py-2">Your current plan</div>
          )}
        </div>

        {/* Pro Plan */}
        <div className={`bg-white rounded-xl border-2 p-6 relative overflow-hidden ${
          isPro ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
        }`}>
          <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl">
            {isPro ? 'CURRENT' : 'RECOMMENDED'}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Crown size={20} className="text-blue-500" />
            <h3 className="text-xl font-bold text-slate-900">Pro</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-4">$29<span className="text-sm font-normal text-slate-500">/month</span></p>
          <ul className="space-y-2 mb-6">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center text-sm text-slate-600">
                <Check size={16} className="mr-2 text-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {isPro ? (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {portalLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
              Manage Billing
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60"
            >
              {checkoutLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
