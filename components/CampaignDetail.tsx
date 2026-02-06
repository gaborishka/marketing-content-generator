
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Send, 
  Filter, 
  History, 
  Monitor,
  RefreshCw,
  Loader2,
  Sparkles,
  FileText,
  Package,
  Info
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { Campaign, Product, GeneratedContent } from '../types';
import { CanvasBoard } from './CanvasBoard';
import { generateMarketingContent } from '../services/geminiService';
import { VideoStoryboardModal } from './VideoStoryboardModal';

interface CampaignDetailProps {
  campaigns: Campaign[];
  products: Product[];
  contentStore: GeneratedContent[];
  onUpdateContent: (content: GeneratedContent[]) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onUpdateItem: (content: GeneratedContent) => void;
}

const AVAILABLE_AUDIENCES = [
  'Healthcare Professionals', 
  'Patients', 
  'Caregivers', 
  'General Public', 
  'Students', 
  'Seniors', 
  'Parents',
  'Pharmacists',
  'Hospital Administrators'
];

const AVAILABLE_CHANNELS = [
  'Email', 
  'LinkedIn', 
  'Twitter', 
  'Instagram', 
  'Web', 
  'TikTok', 
  'Facebook', 
  'YouTube',
  'Pinterest',
  'Video Storyboard'
];

export const CampaignDetail: React.FC<CampaignDetailProps> = ({ 
  campaigns, 
  products, 
  contentStore, 
  onUpdateContent,
  onUpdateCampaign,
  onUpdateItem
}) => {
  const { id } = useParams<{ id: string }>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  const campaign = campaigns.find(c => c.id === id);
  const primaryProduct = products.find(p => p.id === campaign?.primaryProductId);
  const secondaryProducts = products.filter(p => campaign?.secondaryProductIds.includes(p.id));

  // Local state for inputs
  const [keyMessageInput, setKeyMessageInput] = useState('');
  const [contextInput, setContextInput] = useState('');

  // Sync state when campaign loads
  useEffect(() => {
    if (campaign) {
      setKeyMessageInput(campaign.keyMessage);
      setContextInput(campaign.context || '');
    }
  }, [campaign]);

  // Clear status message after 3 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Filter content for this campaign
  const campaignContent = contentStore.filter(c => c.campaignId === id);
  const activeEditingContent = contentStore.find(c => c.id === editingContentId);

  const handleCanvasUpdate = (updatedItems: GeneratedContent[]) => {
    // Update the global store (merging updated items with other campaign items)
    const otherContent = contentStore.filter(c => c.campaignId !== id);
    onUpdateContent([...otherContent, ...updatedItems]);
  };

  const handleGenerateMore = async () => {
    if (!campaign) return;
    
    setIsGenerating(true);
    setStatusMessage(null);

    // 1. Calculate start position for new cards
    let startX = 50;
    if (campaignContent.length > 0) {
      const maxX = Math.max(...campaignContent.map(c => c.x));
      startX = maxX + 400; // 400px gap
    }

    // 2. Create Placeholder Cards
    const newPlaceholders: GeneratedContent[] = [];
    let index = 0;

    // First pass: Fill missing combinations
    for (const channel of campaign.channels) {
      for (const audience of campaign.targetAudiences) {
         const exists = campaignContent.some(c => c.channel === channel && c.audience === audience);
         if (exists) continue;

         newPlaceholders.push({
           id: `temp-${Date.now()}-${index}`,
           campaignId: campaign.id,
           channel,
           audience,
           text: '',
           complianceScore: 0,
           riskLevel: 'low',
           status: 'generating',
           imageUrl: '',
           x: startX + (Math.floor(index / 2) * 340),
           y: 100 + ((index % 2) * 450),
           width: 320
         });
         index++;
      }
    }

    // Fallback: If no gaps, generate alternatives for each channel (using first audience)
    if (newPlaceholders.length === 0) {
       setStatusMessage("All combinations covered. Generating alternatives...");
       let count = 0;
       for (const channel of campaign.channels) {
         if (count >= 3) break; // Limit to 3 to prevent clutter
         const audience = campaign.targetAudiences[0] || 'General Public';
         
         newPlaceholders.push({
           id: `temp-${Date.now()}-${index}`,
           campaignId: campaign.id,
           channel,
           audience,
           text: '',
           complianceScore: 0,
           riskLevel: 'low',
           status: 'generating',
           imageUrl: '',
           x: startX + (Math.floor(index / 2) * 340),
           y: 100 + ((index % 2) * 450),
           width: 320
         });
         index++;
         count++;
       }
    } else {
       setStatusMessage(`Generating ${newPlaceholders.length} missing variants...`);
    }

    if (newPlaceholders.length === 0) {
      setIsGenerating(false);
      setStatusMessage("No channels defined to generate content for.");
      return;
    }

    onUpdateContent([...contentStore, ...newPlaceholders]);

    try {
      // 3. Call API
      const results = await generateMarketingContent(
        campaign, 
        products, // Pass all products
        (updatedContentItem) => {
          onUpdateItem(updatedContentItem);
        }
      );
      
      // 4. Merge results
      const filledPlaceholders: GeneratedContent[] = [];
      const usedResultsIndices = new Set<number>();

      newPlaceholders.forEach(placeholder => {
        // Find a result that matches channel/audience and hasn't been used
        const resultIndex = results.findIndex((r, idx) => 
          r.channel === placeholder.channel && 
          r.audience === placeholder.audience && 
          !usedResultsIndices.has(idx)
        );

        if (resultIndex !== -1) {
          usedResultsIndices.add(resultIndex);
          const match = results[resultIndex];
          filledPlaceholders.push({
            ...match, 
            x: placeholder.x, 
            y: placeholder.y,
            width: placeholder.width,
            id: match.id 
          });
        } else {
          // If no specific match, try to use any unused result (fallback)
           const anyResultIndex = results.findIndex((r, idx) => !usedResultsIndices.has(idx));
           if (anyResultIndex !== -1) {
              usedResultsIndices.add(anyResultIndex);
              const match = results[anyResultIndex];
               filledPlaceholders.push({
                ...match, 
                x: placeholder.x, 
                y: placeholder.y,
                width: placeholder.width,
                id: match.id 
              });
           } else {
              // Failure case
              filledPlaceholders.push({
                ...placeholder,
                status: 'draft',
                text: 'Content generation unavailable for this variant.',
                complianceScore: 0
             } as GeneratedContent);
           }
        }
      });

      const placeholderIds = newPlaceholders.map(p => p.id);
      const contentKeep = contentStore.filter(c => !placeholderIds.includes(c.id)); 
      onUpdateContent([...contentKeep, ...filledPlaceholders]);

    } catch (error) {
      console.error("Failed to generate content:", error);
      const placeholderIds = newPlaceholders.map(p => p.id);
      onUpdateContent(contentStore.filter(c => !placeholderIds.includes(c.id)));
      setStatusMessage("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyMessageBlur = () => {
    if (campaign && keyMessageInput !== campaign.keyMessage) {
      onUpdateCampaign({ ...campaign, keyMessage: keyMessageInput });
    }
  };

  const handleContextBlur = () => {
    if (campaign && contextInput !== campaign.context) {
      onUpdateCampaign({ ...campaign, context: contextInput });
    }
  };

  const handleToggleAudience = (aud: string) => {
    if (!campaign) return;
    const current = campaign.targetAudiences;
    const next = current.includes(aud) 
      ? current.filter(a => a !== aud)
      : [...current, aud];
    onUpdateCampaign({ ...campaign, targetAudiences: next });
  };

  const handleToggleChannel = (ch: string) => {
    if (!campaign) return;
    const current = campaign.channels;
    const next = current.includes(ch) 
      ? current.filter(c => c !== ch)
      : [...current, ch];
    onUpdateCampaign({ ...campaign, channels: next });
  };

  if (!campaign) {
    return <div className="p-8 text-center">Campaign not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Campaign Header */}
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
           
           {/* Section: Context */}
           <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-semibold text-slate-900">Context</h3>
                 <button className="text-slate-400 hover:text-slate-600"><RefreshCw size={14}/></button>
              </div>
              <textarea
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-3"
                 rows={3}
                 value={contextInput}
                 onChange={(e) => setContextInput(e.target.value)}
                 onBlur={handleContextBlur}
                 placeholder="Campaign context..."
               />
               
               {campaign.attachments.length > 0 && (
                 <div className="space-y-1">
                   <span className="text-xs font-semibold text-slate-500 uppercase">Attachments</span>
                   {campaign.attachments.map((file, i) => (
                     <div key={i} className="flex items-center text-xs text-blue-600 bg-blue-50 p-1.5 rounded">
                       <FileText size={12} className="mr-1.5" />
                       <span className="truncate">{file}</span>
                     </div>
                   ))}
                 </div>
               )}
           </div>

           {/* Section: Products */}
           <div className="p-4 border-b border-slate-100">
             <h3 className="font-semibold text-slate-900 mb-3">Products</h3>
             
             {primaryProduct ? (
               <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm mb-3 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-bl font-bold">PRIMARY</div>
                 <div className="flex items-center space-x-2">
                   <div className="w-8 h-8 bg-slate-100 rounded object-cover flex-shrink-0">
                      <img src={primaryProduct.imageUrl} className="w-full h-full rounded object-cover" />
                   </div>
                   <div className="min-w-0">
                     <div className="font-semibold text-sm text-slate-800 truncate">{primaryProduct.name}</div>
                     <div className="text-[10px] text-slate-500">{primaryProduct.brand}</div>
                   </div>
                 </div>
               </div>
             ) : (
                <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg text-xs text-purple-700 flex items-center mb-3">
                   <Package size={14} className="mr-2" />
                   <span>Brand / Idea Campaign</span>
                </div>
             )}

             {secondaryProducts.length > 0 && (
               <div className="space-y-2">
                 <div className="text-[10px] font-bold text-slate-400 uppercase">Secondary</div>
                 {secondaryProducts.map(p => (
                   <div key={p.id} className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-100">
                      <div className="w-5 h-5 bg-slate-200 rounded flex-shrink-0">
                         <img src={p.imageUrl} className="w-full h-full rounded object-cover" />
                      </div>
                      <span className="text-xs text-slate-700 truncate">{p.name}</span>
                   </div>
                 ))}
               </div>
             )}
           </div>

           {/* Section: Key Message */}
           <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Key Message</label>
               <textarea
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                 rows={3}
                 value={keyMessageInput}
                 onChange={(e) => setKeyMessageInput(e.target.value)}
                 onBlur={handleKeyMessageBlur}
               />
           </div>

           {/* Section: Target Audiences */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-2">
               <h3 className="font-semibold text-slate-900">Target Audiences</h3>
             </div>
             
             <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
               {AVAILABLE_AUDIENCES.map(aud => (
                 <label key={aud} className="flex items-center space-x-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                   <div className="relative flex items-center">
                     <input 
                      type="checkbox"
                      className="peer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={campaign.targetAudiences.includes(aud)}
                      onChange={() => handleToggleAudience(aud)}
                     />
                   </div>
                   <span className="text-xs text-slate-700 font-medium">{aud}</span>
                 </label>
               ))}
             </div>
           </div>

           {/* Section: Channels */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900">Channels</h3>
             </div>
             <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {AVAILABLE_CHANNELS.map(ch => (
                  <label key={ch} className="flex items-center space-x-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                   <div className="relative flex items-center">
                     <input 
                      type="checkbox"
                      className="peer h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      checked={campaign.channels.includes(ch)}
                      onChange={() => handleToggleChannel(ch)}
                     />
                   </div>
                   <div className="flex items-center text-xs text-slate-700 font-medium">
                     <Monitor size={12} className="mr-2 text-slate-400" />
                     {ch}
                   </div>
                 </label>
                ))}
             </div>
           </div>

           <div className="p-4 mt-auto">
             {statusMessage && (
               <div className="mb-2 p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100 flex items-start animate-fadeIn">
                 <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                 <span>{statusMessage}</span>
               </div>
             )}
             <button 
               onClick={handleGenerateMore}
               disabled={isGenerating}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
             >
               {isGenerating ? (
                 <>
                   <Loader2 size={18} className="animate-spin" />
                   <span>Generating...</span>
                 </>
               ) : (
                 <>
                   <Sparkles size={18} />
                   <span>Generate New Variants</span>
                 </>
               )}
             </button>
           </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
           <CanvasBoard 
              items={campaignContent} 
              onItemsChange={handleCanvasUpdate} 
              onEdit={(id) => setEditingContentId(id)}
           />
        </div>
      </div>

      {activeEditingContent && (
        <VideoStoryboardModal 
          content={activeEditingContent}
          onClose={() => setEditingContentId(null)}
          onUpdate={onUpdateItem}
        />
      )}
    </div>
  );
};
