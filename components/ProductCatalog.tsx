import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Tag, Pencil, Trash2, X, DollarSign, Package, Store, RefreshCw, Check, Loader2, Unplug } from 'lucide-react';
import { Product } from '../types';
import { ShopifyConnectModal } from './ShopifyConnectModal';
import { ShopifyStatus, browseShopifyProducts, importShopifyProducts, resyncShopifyProducts, disconnectShopify } from '../services/shopifyService';

interface ProductCatalogProps {
  products: Product[];
  onCreate: (product: Product) => void;
  onUpdate: (product: Product) => void;
  onDelete: (productId: string) => void;
  shopifyStatus?: ShopifyStatus;
  onShopifyStatusChange?: () => void;
  onProductsImported?: () => void;
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

type Tab = 'my-products' | 'import-shopify';

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products, onCreate, onUpdate, onDelete,
  shopifyStatus, onShopifyStatusChange, onProductsImported,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, editingProduct: null });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('my-products');

  // Shopify import tab state
  const [shopifyProducts, setShopifyProducts] = useState<Product[]>([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifySearch, setShopifySearch] = useState('');
  const [shopifyNextPage, setShopifyNextPage] = useState<string | null>(null);
  const [shopifyHasMore, setShopifyHasMore] = useState(false);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  // Set of already-imported Shopify product IDs
  const importedShopifyIds = useMemo(() => {
    return new Set(products.filter(p => p.source === 'shopify').map(p => p.shopifyProductId).filter(Boolean));
  }, [products]);

  // Detect ?shopify=connected from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('shopify') === 'connected') {
      onShopifyStatusChange?.();
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname + '#/products');
    }
  }, [onShopifyStatusChange]);

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

    const productData = {
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
    };

    if (modal.editingProduct) {
      onUpdate({ ...productData, id: modal.editingProduct.id, source: modal.editingProduct.source || 'internal' });
    } else {
      onCreate({ ...productData, id: `prod-${Date.now()}`, source: 'internal' });
    }
    closeModal();
  };

  // ── Shopify browsing ───────────────────────────────────────────────────

  const loadShopifyProducts = async (query?: string, pageInfo?: string) => {
    setShopifyLoading(true);
    try {
      const result = await browseShopifyProducts(query || undefined, 20, pageInfo || undefined);
      if (pageInfo) {
        setShopifyProducts(prev => [...prev, ...result.products]);
      } else {
        setShopifyProducts(result.products);
      }
      setShopifyNextPage(result.nextPageInfo);
      setShopifyHasMore(result.hasMore);
    } catch (err: any) {
      console.error('Failed to browse Shopify products:', err);
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleShopifySearch = () => {
    setShopifyProducts([]);
    setSelectedForImport(new Set());
    loadShopifyProducts(shopifySearch);
  };

  const handleLoadMore = () => {
    if (shopifyNextPage) {
      loadShopifyProducts(shopifySearch, shopifyNextPage);
    }
  };

  const toggleImportSelection = (shopifyProductId: string) => {
    setSelectedForImport(prev => {
      const next = new Set(prev);
      if (next.has(shopifyProductId)) next.delete(shopifyProductId);
      else next.add(shopifyProductId);
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (selectedForImport.size === 0) return;
    setImporting(true);
    setImportMessage('');
    try {
      const result = await importShopifyProducts(Array.from(selectedForImport));
      setImportMessage(`Successfully imported ${result.imported} product${result.imported !== 1 ? 's' : ''}.`);
      setSelectedForImport(new Set());
      onProductsImported?.();
    } catch (err: any) {
      setImportMessage(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleResync = async () => {
    setResyncing(true);
    setImportMessage('');
    try {
      const result = await resyncShopifyProducts();
      setImportMessage(`Resynced ${result.synced} product${result.synced !== 1 ? 's' : ''}.${result.failed.length ? ` ${result.failed.length} failed.` : ''}`);
      onProductsImported?.();
    } catch (err: any) {
      setImportMessage(`Resync failed: ${err.message}`);
    } finally {
      setResyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectShopify();
      onShopifyStatusChange?.();
      setActiveTab('my-products');
      setShopifyProducts([]);
    } catch (err: any) {
      console.error('Failed to disconnect Shopify:', err);
    }
  };

  // Auto-load Shopify products when switching to import tab
  useEffect(() => {
    if (activeTab === 'import-shopify' && shopifyStatus?.connected && shopifyProducts.length === 0) {
      loadShopifyProducts();
    }
  }, [activeTab, shopifyStatus?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────

  const renderProductCard = (product: Product, isShopifyBrowse = false) => {
    const isImported = importedShopifyIds.has(product.shopifyProductId);
    const isSelected = selectedForImport.has(product.shopifyProductId || '');

    return (
      <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
        <div className="relative h-48 overflow-hidden bg-slate-100">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={32} className="text-slate-300" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-slate-900 shadow-sm">
              ${product.price}
            </span>
          </div>
          {product.source === 'shopify' && !isShopifyBrowse && (
            <div className="absolute top-2 left-2">
              <span className="bg-green-500 text-white px-2 py-0.5 rounded-md text-xs font-medium flex items-center space-x-1">
                <Store size={10} />
                <span>Shopify</span>
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center space-x-2 mb-2">
            {product.category && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                {product.category}
              </span>
            )}
            {product.brand && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                {product.brand}
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">{product.name}</h3>
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">{product.description}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {(product.marketingTags || []).slice(0, 3).map((tag, idx) => (
              <span key={idx} className="flex items-center text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                <Tag size={10} className="mr-1" /> {tag}
              </span>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            {isShopifyBrowse ? (
              isImported ? (
                <span className="flex items-center text-xs text-green-600 font-medium">
                  <Check size={14} className="mr-1" /> Imported
                </span>
              ) : (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleImportSelection(product.shopifyProductId || '')}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">Select</span>
                </label>
              )
            ) : (
              <span className="text-xs text-slate-400">SKU: {product.sku}</span>
            )}

            {!isShopifyBrowse && (
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
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="text-slate-500">Manage your product information and assets.</p>
        </div>
        <div className="flex items-center space-x-3">
          {shopifyStatus?.connected && (
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={resyncing ? 'animate-spin' : ''} />
              <span>{resyncing ? 'Resyncing...' : 'Resync Shopify'}</span>
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

      {/* Shopify Connection Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        {shopifyStatus?.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Store size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Connected to {shopifyStatus.shopName || shopifyStatus.shopDomain}
                </p>
                <p className="text-xs text-slate-500">{shopifyStatus.shopDomain}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center space-x-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <Unplug size={14} />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                <Store size={16} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Connect your Shopify store</p>
                <p className="text-xs text-slate-500">Import products directly from Shopify for your campaigns.</p>
              </div>
            </div>
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Store size={14} />
              <span>Connect Shopify</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {shopifyStatus?.connected && (
        <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('my-products')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'my-products'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            My Products
          </button>
          <button
            onClick={() => setActiveTab('import-shopify')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'import-shopify'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Import from Shopify
          </button>
        </div>
      )}

      {/* Import message */}
      {importMessage && (
        <div className="bg-blue-50 text-blue-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{importMessage}</span>
          <button onClick={() => setImportMessage('')} className="text-blue-500 hover:text-blue-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* My Products Tab */}
      {activeTab === 'my-products' && (
        <>
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
                  ? 'Add your first product to start creating marketing campaigns.'
                  : 'Try a different search term.'}
              </p>
              {products.length === 0 && (
                <button
                  onClick={openCreate}
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  <Plus size={18} />
                  <span>Add First Product</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => renderProductCard(product))}
            </div>
          )}
        </>
      )}

      {/* Import from Shopify Tab */}
      {activeTab === 'import-shopify' && (
        <>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search Shopify products..."
                value={shopifySearch}
                onChange={(e) => setShopifySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleShopifySearch()}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleShopifySearch}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Search
            </button>
          </div>

          {selectedForImport.size > 0 && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <span className="text-sm text-green-800 font-medium">
                {selectedForImport.size} product{selectedForImport.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleImportSelected}
                disabled={importing}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                <span>{importing ? 'Importing...' : 'Import Selected'}</span>
              </button>
            </div>
          )}

          {shopifyLoading && shopifyProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Loader2 size={32} className="mx-auto text-green-500 animate-spin mb-4" />
              <p className="text-slate-500 text-sm">Loading Shopify products...</p>
            </div>
          ) : shopifyProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Store size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No products found</h3>
              <p className="text-slate-500 text-sm">Try a different search or check your Shopify store.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {shopifyProducts.map((product) => renderProductCard(product, true))}
              </div>
              {shopifyHasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={shopifyLoading}
                    className="px-6 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {shopifyLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
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

      {/* Shopify Connect Modal */}
      {showConnectModal && (
        <ShopifyConnectModal onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  );
};
