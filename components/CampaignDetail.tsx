import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Send, 
  Filter, 
  History, 
  Search,
  CheckSquare,
  Users,
  Monitor,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { Campaign, Product, GeneratedContent } from '../types';
import { CanvasBoard } from './CanvasBoard';

interface CampaignDetailProps {
  campaigns: Campaign[];
  products: Product[];
  contentStore: GeneratedContent[];
  onUpdateContent: (content: GeneratedContent[]) => void;
}

export const CampaignDetail: React.FC<CampaignDetailProps> = ({ 
  campaigns, 
  products, 
  contentStore, 
  onUpdateContent 
}) => {
  const { id } = useParams<{ id: string }>();
  const campaign = campaigns.find(c => c.id === id);
  const product = products.find(p => p.id === campaign?.productId);

  // Filter content for this campaign
  const campaignContent = contentStore.filter(c => c.campaignId === id);

  const handleCanvasUpdate = (updatedItems: GeneratedContent[]) => {
    // Update the global store (merging updated items with other campaign items)
    const otherContent = contentStore.filter(c => c.campaignId !== id);
    onUpdateContent([...otherContent, ...updatedItems]);
  };

  if (!campaign) {
    return <div className="p-8 text-center">Campaign not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Campaign Header Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link to="/campaigns" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
             <div className="flex items-center space-x-2 text-sm text-slate-500 mb-0.5">
               <span>Campaigns</span>
               <span>/</span>
               <span className="font-medium text-slate-900">{campaign.name}</span>
             </div>
             <h1 className="text-lg font-bold text-slate-900 leading-none">Canvas Workspace</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <Filter size={16} />
            <span>Filters</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <History size={16} />
            <span>History</span>
          </button>
          <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
          <button className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
            <Send size={16} />
            <span>Publish</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Controls */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 overflow-y-auto">
           {/* Section: Product & Message */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="font-semibold text-slate-900">Product & Message</h3>
               <button className="text-slate-400 hover:text-slate-600"><RefreshCw size={14}/></button>
             </div>
             
             {product && (
               <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-3">
                 <div className="flex items-center space-x-2 mb-1">
                   <div className="w-6 h-6 bg-red-200 rounded text-xs flex items-center justify-center font-bold text-red-700">
                     {product.name.substring(0,2).toUpperCase()}
                   </div>
                   <span className="font-semibold text-sm text-slate-800">{product.name}</span>
                 </div>
                 <p className="text-xs text-slate-600 line-clamp-2">{product.description}</p>
               </div>
             )}

             <div className="mb-2">
               <label className="text-xs font-semibold text-slate-500 uppercase">Key Message</label>
               <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
                 {campaign.keyMessage}
               </div>
             </div>
           </div>

           {/* Section: Target Audiences */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="font-semibold text-slate-900">Target Audiences</h3>
               <button className="text-slate-400 hover:text-slate-600"><Users size={16}/></button>
             </div>
             <div className="space-y-2">
               {campaign.targetAudiences.map(aud => (
                 <div key={aud} className="flex items-center text-sm text-slate-700">
                   <CheckSquare size={16} className="text-blue-600 mr-2" />
                   {aud}
                 </div>
               ))}
               <div className="flex items-center text-sm text-slate-400">
                 <CheckSquare size={16} className="mr-2 opacity-50" />
                 Parents
               </div>
               <div className="flex items-center text-sm text-slate-400">
                 <CheckSquare size={16} className="mr-2 opacity-50" />
                 Seniors
               </div>
             </div>
           </div>

           {/* Section: Channels */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Channels</h3>
                <button className="text-slate-400 hover:text-slate-600"><Monitor size={16}/></button>
             </div>
             <div className="space-y-2">
                {campaign.channels.map(ch => (
                  <div key={ch} className="flex items-center text-sm text-slate-700">
                    <CheckSquare size={16} className="text-blue-600 mr-2" />
                    {ch}
                  </div>
                ))}
             </div>
           </div>

           <div className="p-4 mt-auto">
             <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-blue-500/20">
               <Plus size={18} />
               <span>Generate New Variants</span>
             </button>
           </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          <CanvasBoard 
            items={campaignContent} 
            onItemsChange={handleCanvasUpdate} 
          />
        </div>
      </div>
    </div>
  );
};
