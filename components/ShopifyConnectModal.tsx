import React, { useState } from 'react';
import { X, Store, Loader2 } from 'lucide-react';
import { startShopifyAuth } from '../services/shopifyService';

interface ShopifyConnectModalProps {
  onClose: () => void;
}

export const ShopifyConnectModal: React.FC<ShopifyConnectModalProps> = ({ onClose }) => {
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain.trim());

  const handleConnect = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const { authUrl } = await startShopifyAuth(shopDomain.trim());
      window.location.href = authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to start Shopify authentication.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Store size={20} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Connect Shopify</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Enter your Shopify store domain to connect and import products for your marketing campaigns.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Store Domain</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="your-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => {
                setShopDomain(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            {shopDomain && !isValid && (
              <p className="text-xs text-amber-600 mt-1">Must be a valid myshopify.com domain</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!isValid || loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{loading ? 'Connecting...' : 'Connect Store'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
