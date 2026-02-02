import React from 'react';
import { Search, Filter, Plus, Tag } from 'lucide-react';
import { Product } from '../types';

interface ProductCatalogProps {
  products: Product[];
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products }) => {
  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="text-slate-500">Manage your product information and assets.</p>
        </div>
        <button className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
          <Plus size={18} />
          <span>Add Product</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products by name, SKU or brand..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
          <Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
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
                <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
