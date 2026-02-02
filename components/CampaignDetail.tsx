import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Send, 
  Filter, 
  History, 
  CheckSquare,
  Users,
  Monitor,
  RefreshCw,
  Plus,
  Loader2,
  Sparkles,
  X,
  Trash2
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { Campaign, Product, GeneratedContent } from '../types';
import { CanvasBoard } from './CanvasBoard';
import { generateMarketingContent } from '../services/geminiService';

interface CampaignDetailProps {
  campaigns: Campaign[];
  products: Product[];
  contentStore: GeneratedContent[];
  onUpdateContent: (content: GeneratedContent[]) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
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
  'Pinterest'
];

export const CampaignDetail: React.FC<CampaignDetailProps> = ({ 
  campaigns, 
  products, 
  contentStore, 
  onUpdateContent,
  onUpdateCampaign
}) => {
  const { id } = useParams<{ id: string }>();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const campaign = campaigns.find(c => c.id === id);
  const product = products.find(p => p.id === campaign?.productId);

  // Local state for inputs
  const [keyMessageInput, setKeyMessageInput] = useState('');
  const [newAudience, setNewAudience] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [isAddingAudience, setIsAddingAudience] = useState(false);
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  // Sync state when campaign loads
  useEffect(() => {
    if (campaign) {
      setKeyMessageInput(campaign.keyMessage);
    }
  }, [campaign]);

  // Filter content for this campaign
  const campaignContent = contentStore.filter(c => c.campaignId === id);

  const handleCanvasUpdate = (updatedItems: GeneratedContent[]) => {
    // Update the global store (merging updated items with other campaign items)
    const otherContent = contentStore.filter(c => c.campaignId !== id);
    onUpdateContent([...otherContent, ...updatedItems]);
  };

  const handleGenerateMore = async () => {
    if (!campaign || !product) return;
    
    setIsGenerating(true);

    // 1. Calculate start position for new cards (right of existing cards)
    let startX = 50;
    if (campaignContent.length > 0) {
      const maxX = Math.max(...campaignContent.map(c => c.x));
      startX = maxX + 400; // 400px gap
    }

    // 2. Create Placeholder Cards for all Combinations (Audience x Channel)
    const newPlaceholders: GeneratedContent[] = [];
    let index = 0;

    for (const channel of campaign.channels) {
      for (const audience of campaign.targetAudiences) {
         newPlaceholders.push({
           id: `temp-${Date.now()}-${index}`,
           campaignId: campaign.id,
           channel,
           audience,
           text: '',
           complianceScore: 0,
           riskLevel: 'low',
           status: 'generating', // Set status to generating
           imageUrl: '',
           x: startX + (Math.floor(index / 2) * 340), // Grid layout logic
           y: 100 + ((index % 2) * 450),
           width: 320
         });
         index++;
      }
    }

    // 3. Immediately render placeholders on canvas
    onUpdateContent([...contentStore, ...newPlaceholders]);

    try {
      // 4. Call API to generate real content
      const results = await generateMarketingContent(campaign, product);
      
      // 5. Merge real results into placeholders to preserve position
      const completedContent = newPlaceholders.map(placeholder => {
        // Find matching result by metadata
        const match = results.find(r => r.channel === placeholder.channel && r.audience === placeholder.audience);
        
        if (match) {
          return {
            ...match, // Use generated content
            x: placeholder.x, // Keep placeholder position
            y: placeholder.y,
            width: placeholder.width,
            id: match.id // Use real ID
          };
        }
        
        // Fallback if API didn't return a match (e.g. error for specific variant)
        return {
           ...placeholder,
           status: 'draft',
           text: 'Content generation unavailable for this variant.',
           complianceScore: 0
        } as GeneratedContent;
      });

      const placeholderIds = newPlaceholders.map(p => p.id);
      const contentKeep = contentStore.filter(c => !placeholderIds.includes(c.id)); 
      
      onUpdateContent([...contentKeep, ...completedContent]);

    } catch (error) {
      console.error("Failed to generate content:", error);
      // On error, revert to store without placeholders
      const placeholderIds = newPlaceholders.map(p => p.id);
      onUpdateContent(contentStore.filter(c => !placeholderIds.includes(c.id)));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyMessageBlur = () => {
    if (campaign && keyMessageInput !== campaign.keyMessage) {
      onUpdateCampaign({ ...campaign, keyMessage: keyMessageInput });
    }
  };

  const handleAddAudience = () => {
    if (campaign && newAudience && !campaign.targetAudiences.includes(newAudience)) {
      onUpdateCampaign({ ...campaign, targetAudiences: [...campaign.targetAudiences, newAudience] });
      setNewAudience('');
      setIsAddingAudience(false);
    }
  };

  const handleRemoveAudience = (aud: string) => {
    if (campaign) {
      onUpdateCampaign({ ...campaign, targetAudiences: campaign.targetAudiences.filter(a => a !== aud) });
    }
  };

  const handleAddChannel = () => {
    if (campaign && newChannel && !campaign.channels.includes(newChannel)) {
      onUpdateCampaign({ ...campaign, channels: [...campaign.channels, newChannel] });
      setNewChannel('');
      setIsAddingChannel(false);
    }
  };

  const handleRemoveChannel = (ch: string) => {
    if (campaign) {
      onUpdateCampaign({ ...campaign, channels: campaign.channels.filter(c => c !== ch) });
    }
  };

  if (!campaign) {
    return <div className="p-8 text-center">Campaign not found</div>;
  }

  // Derived state for available options (filtering out already selected)
  const availableAudiencesToSelect = AVAILABLE_AUDIENCES.filter(
    a => !campaign.targetAudiences.includes(a)
  );

  const availableChannelsToSelect = AVAILABLE_CHANNELS.filter(
    c => !campaign.channels.includes(c)
  );

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
               <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Key Message</label>
               <textarea
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                 rows={4}
                 value={keyMessageInput}
                 onChange={(e) => setKeyMessageInput(e.target.value)}
                 onBlur={handleKeyMessageBlur}
               />
             </div>
           </div>

           {/* Section: Target Audiences */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="font-semibold text-slate-900">Target Audiences</h3>
               {availableAudiencesToSelect.length > 0 && (
                 <button 
                  onClick={() => setIsAddingAudience(true)}
                  className="text-slate-400 hover:text-blue-600 transition-colors"
                 >
                   <Plus size={16}/>
                 </button>
               )}
             </div>
             
             <div className="space-y-2 mb-2">
               {campaign.targetAudiences.map(aud => (
                 <div key={aud} className="flex items-center justify-between text-sm text-slate-700 group hover:bg-slate-50 p-1 rounded">
                   <div className="flex items-center">
                    <CheckSquare size={16} className="text-blue-600 mr-2" />
                    {aud}
                   </div>
                   <button 
                    onClick={() => handleRemoveAudience(aud)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <X size={14} />
                   </button>
                 </div>
               ))}
             </div>

             {isAddingAudience && (
                <div className="flex items-center space-x-2 mt-2 animate-fadeIn">
                  <select
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 outline-none bg-white"
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                    autoFocus
                  >
                    <option value="" disabled>Select...</option>
                    {availableAudiencesToSelect.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAddAudience} 
                    disabled={!newAudience}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    onClick={() => { setIsAddingAudience(false); setNewAudience(''); }} 
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
             )}
           </div>

           {/* Section: Channels */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Channels</h3>
                {availableChannelsToSelect.length > 0 && (
                  <button 
                    onClick={() => setIsAddingChannel(true)}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Plus size={16}/>
                  </button>
                )}
             </div>
             <div className="space-y-2 mb-2">
                {campaign.channels.map(ch => (
                  <div key={ch} className="flex items-center justify-between text-sm text-slate-700 group hover:bg-slate-50 p-1 rounded">
                    <div className="flex items-center">
                      <Monitor size={16} className="text-slate-400 mr-2" />
                      {ch}
                    </div>
                    <button 
                      onClick={() => handleRemoveChannel(ch)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
             </div>

             {isAddingChannel && (
                <div className="flex items-center space-x-2 mt-2 animate-fadeIn">
                  <select
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 outline-none bg-white"
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    autoFocus
                  >
                    <option value="" disabled>Select...</option>
                    {availableChannelsToSelect.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAddChannel} 
                    disabled={!newChannel}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    onClick={() => { setIsAddingChannel(false); setNewChannel(''); }} 
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
             )}
           </div>

           <div className="p-4 mt-auto">
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
          />
        </div>
      </div>
    </div>
  );
};