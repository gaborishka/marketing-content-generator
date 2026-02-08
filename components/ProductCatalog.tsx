import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Tag, Pencil, Trash2, X, DollarSign, Package, RefreshCw, Link2, Unlink, Store, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product, ShopifyConnection } from '../types';
import {
  startShopifyAuth,
  completeShopifyAuth,
  getShopifyConnection,
  syncShopifyProducts,
  disconnectShopify,
  parseShopifyCallbackParams,
  clearShopifyCallbackParams,
} from '../services/shopifyService';

interface ProductCatalogProps {
  products: Product[];
  onCreate: (product: Product) => void;
  onUpdate: (product: Product) => void;
  onDelete: (productId: string) => void;
  onReloadProducts?: () => void;
}

interface ModalState {
  open: boolean;
  editingProduct: Product | null;
}

interface DeleteConfirm {
  productId: string;
  productName: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  brand: '',
  category: '',
  description: '',
  price: '',
  features: '',
  imageUrl: '',
  marketingTags: '',
};

interface ProductForm {
  name: string;
  sku: string;
  brand: string;
  category: string;
  description: string;
  price: string;
  features: string;
  imageUrl: string;
  marketingTags: string;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  removed: number;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products, onCreate, onUpdate, onDelete, onReloadProducts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, editingProduct: null });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  // Shopify state
  const [shopifyConnection, setShopifyConnection] = useState<ShopifyConnection | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(true);
  const [showShopifyConnect, setShowShopifyConnect] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [shopifyError, setShopifyError] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  // Load Shopify connection status on mount
  useEffect(() => {
    loadShopifyConnection();
  }, []);

  // Handle Shopify OAuth callback params in URL
  useEffect(() => {
    const params = parseShopifyCallbackParams();
    if (params) {
      handleShopifyCallback(params.shop, params.code, params.state);
      clearShopifyCallbackParams();
    }
  }, []);

  const loadShopifyConnection = useCallback(async () => {
    try {
      setShopifyLoading(true);
      const conn = await getShopifyConnection();
      setShopifyConnection(conn);
    } catch (e) {
      console.error('Failed to load Shopify connection:', e);
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  const handleShopifyCallback = async (shop: string, code: string, state: string) => {
    try {
      setConnectingShopify(true);
      setShopifyError(null);
      await completeShopifyAuth(shop, code, state);
      await loadShopifyConnection();
      setShowShopifyConnect(false);
    } catch (e: any) {
      setShopifyError(e.message || 'Failed to complete Shopify connection.');
    } finally {
      setConnectingShopify(false);
    }
  };

  const handleConnectShopify = async () => {
    if (!shopDomain.trim()) return;
    try {
      setConnectingShopify(true);
      setShopifyError(null);
      const { authUrl } = await startShopifyAuth(shopDomain.trim());
      // Redirect the user to Shopify for authorization
      window.location.href = authUrl;
    } catch (e: any) {
      setShopifyError(e.message || 'Failed to start Shopify connection.');
      setConnectingShopify(false);
    }
  };

  const handleSyncProducts = async () => {
    try {
      setSyncStatus('syncing');
      setSyncResult(null);
      setShopifyError(null);
      const result = await syncShopifyProducts();
      setSyncResult(result);
      setSyncStatus('success');
      // Reload products to reflect synced data
      onReloadProducts?.();
      // Refresh connection info (updates lastSyncedAt)
      await loadShopifyConnection();
    } catch (e: any) {
      setShopifyError(e.message || 'Failed to sync products.');
      setSyncStatus('error');
    }
  };

  const handleDisconnectShopify = async () => {
    try {
      setShopifyError(null);
      await disconnectShopify();
      setShopifyConnection(null);
      setDisconnectConfirm(false);
    } catch (e: any) {
      setShopifyError(e.message || 'Failed to disconnect Shopify.');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const shopifyProductCount = useMemo(
    () => products.filter(p => p.source === 'shopify').length,
    [products]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModal({ open: true, editingProduct: null });
  };

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      category: product.category,
      description: product.description,
      price: String(product.price),
      features: product.features.join(', '),
      imageUrl: product.imageUrl,
      marketingTags: product.marketingTags.join(', '),
    });
    setModal({ open: true, editingProduct: product });
  };

  const closeModal = () => {
    setModal({ open: false, editingProduct: null });
  };

  const updateField = (field: keyof ProductForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const parseCommaSeparated = (value: string): string[] =>
    value.split(',').map(s => s.trim()).filter(Boolean);

  const isFormValid = form.name.trim() && form.sku.trim() && form.brand.trim() && form.category.trim() && form.price.trim() && !isNaN(Number(form.price));

  const handleSave = () => {
    if (!isFormValid) return;

    const productData: Omit<Product, 'id'> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      features: parseCommaSeparated(form.features),
      imageUrl: form.imageUrl.trim(),
      complianceFiles: modal.editingProduct?.complianceFiles || [],
      marketingTags: parseCommaSeparated(form.marketingTags),
      // Preserve Shopify source metadata so syncs don't create duplicates (H1)
      ...(modal.editingProduct?.source && { source: modal.editingProduct.source }),
      ...(modal.editingProduct?.shopifyProductId && { shopifyProductId: modal.editingProduct.shopifyProductId }),
      ...(modal.editingProduct?.shopifyVariantId && { shopifyVariantId: modal.editingProduct.shopifyVariantId }),
    };

    if (modal.editingProduct) {
      onUpdate({ ...productData, id: modal.editingProduct.id });
    } else {
      onCreate({ ...productData, id: `prod-${Date.now()}` });
    }
    closeModal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="text-slate-500">Manage your product information and assets.</p>
        </div>
        <div className="flex items-center space-x-3">
          {!shopifyConnection && !showShopifyConnect && (
            <button
              onClick={() => setShowShopifyConnect(true)}
              className="flex items-center justify-center space-x-2 bg-[#96bf48] hover:bg-[#7a9e3a] text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              <Store size={18} />
              <span>Connect Shopify</span>
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Shopify Connection Panel */}
      {shopifyConnection && (
        <div className="bg-gradient-to-r from-[#96bf48]/10 to-[#5e8e3e]/10 border border-[#96bf48]/30 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-[#96bf48] rounded-lg flex items-center justify-center flex-shrink-0">
                <Store size={20} className="text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-slate-900">Shopify Connected</h3>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Active</span>
                </div>
                <p className="text-sm text-slate-600">
                  {shopifyConnection.shop}
                  {shopifyConnection.productCount != null && (
                    <span className="ml-2 text-slate-400">
                      ({shopifyConnection.productCount} products synced)
                    </span>
                  )}
                  {shopifyConnection.lastSyncedAt && (
                    <span className="ml-2 text-slate-400">
                      Last sync: {new Date(shopifyConnection.lastSyncedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSyncProducts}
                disabled={syncStatus === 'syncing'}
                className="flex items-center space-x-2 bg-[#96bf48] hover:bg-[#7a9e3a] text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Products'}</span>
              </button>
              <button
                onClick={() => setDisconnectConfirm(true)}
                className="flex items-center space-x-2 text-slate-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm"
                title="Disconnect Shopify"
              >
                <Unlink size={16} />
              </button>
            </div>
          </div>

          {/* Sync result message */}
          {syncStatus === 'success' && syncResult && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} />
              <span>
                Sync complete: {syncResult.created} new, {syncResult.updated} updated, {syncResult.removed} removed
                ({syncResult.synced} total from Shopify)
              </span>
            </div>
          )}

          {syncStatus === 'error' && shopifyError && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={16} />
              <span>{shopifyError}</span>
            </div>
          )}
        </div>
      )}

      {/* Shopify Connect Modal */}
      {showShopifyConnect && !shopifyConnection && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#96bf48] rounded-lg flex items-center justify-center">
                <Store size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Connect your Shopify Store</h3>
                <p className="text-sm text-slate-500">Import products directly from your Shopify catalog</p>
              </div>
            </div>
            <button
              onClick={() => { setShowShopifyConnect(false); setShopifyError(null); }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="yourstore.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnectShopify()}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#96bf48] focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={handleConnectShopify}
              disabled={!shopDomain.trim() || connectingShopify}
              className="flex items-center justify-center space-x-2 bg-[#96bf48] hover:bg-[#7a9e3a] text-white px-6 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectingShopify ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Link2 size={18} />
              )}
              <span>{connectingShopify ? 'Connecting...' : 'Connect'}</span>
            </button>
          </div>

          {shopifyError && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-red-600">
              <AlertCircle size={16} />
              <span>{shopifyError}</span>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">
            You will be redirected to Shopify to authorize read access to your product catalog.
            We only request <code className="bg-slate-100 px-1 rounded">read_products</code> permission.
          </p>
        </div>
      )}

      {/* Shopify Loading State */}
      {shopifyLoading && (
        <div className="flex items-center justify-center py-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin mr-2" />
          Checking Shopify connection...
        </div>
      )}

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search products by name, SKU, brand or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">
            {products.length === 0 ? 'No products yet' : 'No products match your search'}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {products.length === 0
              ? 'Add your first product manually or connect your Shopify store to import products.'
              : 'Try a different search term.'}
          </p>
          {products.length === 0 && (
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={openCreate}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                <Plus size={18} />
                <span>Add Product</span>
              </button>
              {!shopifyConnection && (
                <button
                  onClick={() => setShowShopifyConnect(true)}
                  className="inline-flex items-center space-x-2 bg-[#96bf48] hover:bg-[#7a9e3a] text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  <Store size={18} />
                  <span>Connect Shopify</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2 right-2">
                  <span className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-slate-900 shadow-sm">
                    ${product.price}
                  </span>
                </div>
                {product.source === 'shopify' && (
                  <div className="absolute top-2 left-2">
                    <span className="bg-[#96bf48]/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm flex items-center space-x-1">
                      <Store size={10} />
                      <span>Shopify</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                    {product.category}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                    {product.brand}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">{product.name}</h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{product.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {product.marketingTags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="flex items-center text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                      <Tag size={10} className="mr-1" /> {tag}
                    </span>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">SKU: {product.sku}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEdit(product)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit product"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ productId: product.id, productName: product.name })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product count summary with Shopify info */}
      {products.length > 0 && shopifyProductCount > 0 && (
        <div className="text-center text-xs text-slate-400 pt-2">
          {products.length} total products ({shopifyProductCount} from Shopify, {products.length - shopifyProductCount} manual)
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {modal.editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modal.editingProduct?.source === 'shopify' && (
                <div className="flex items-start space-x-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    This product is synced from Shopify. Fields like name, price, and image will be overwritten on the next sync.
                    Custom fields (features, marketing tags) you add here will be preserved.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. Respirol"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. MC-2004"
                    value={form.sku}
                    onChange={(e) => updateField('sku', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. MediCure"
                    value={form.brand}
                    onChange={(e) => updateField('brand', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. Pharmaceuticals"
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 resize-none"
                  placeholder="Product description for marketing context..."
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="flex items-center space-x-1">
                      <DollarSign size={14} />
                      <span>Price *</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="https://example.com/image.jpg"
                    value={form.imageUrl}
                    onChange={(e) => updateField('imageUrl', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Features</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Comma-separated, e.g. 12-hour relief, Non-drowsy"
                  value={form.features}
                  onChange={(e) => updateField('features', e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Separate multiple features with commas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marketing Tags</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Comma-separated, e.g. pain relief, seniors, active lifestyle"
                  value={form.marketingTags}
                  onChange={(e) => updateField('marketingTags', e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Separate multiple tags with commas</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modal.editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Product</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Delete "<span className="font-medium">{deleteConfirm.productName}</span>"? This will also remove it from any campaigns that reference it. This cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirm.productId);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopify Disconnect Confirmation Modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Unlink size={18} className="text-orange-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Disconnect Shopify</h2>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Disconnect from <span className="font-medium">{shopifyConnection?.shop}</span>?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Products already synced will remain in your catalog, but you won't be able to sync new changes from Shopify until you reconnect.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDisconnectConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectShopify}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
