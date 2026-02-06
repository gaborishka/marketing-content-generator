
import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  CheckCircle2,
  Circle,
  Paperclip,
  FileText,
  Lightbulb
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Campaign, Product, GeneratedContent } from '../types';
import { generateMarketingContent } from '../services/geminiService';

interface ContentGeneratorProps {
  products: Product[];
  onComplete: (campaign: Campaign, content: GeneratedContent[]) => void;
  onUpdateItem: (content: GeneratedContent) => void;
}

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({ products, onComplete, onUpdateItem }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection State
  const [primaryProductId, setPrimaryProductId] = useState<string | undefined>(undefined);
  const [secondaryProductIds, setSecondaryProductIds] = useState<string[]>([]);
  const [isBrandCampaign, setIsBrandCampaign] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [context, setContext] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [audiences, setAudiences] = useState<string[]>(['General']);
  const [channels, setChannels] = useState<string[]>(['Social Media']);
  
  const handlePrimarySelect = (id: string) => {
    if (primaryProductId === id) {
      setPrimaryProductId(undefined);
    } else {
      setPrimaryProductId(id);
      setIsBrandCampaign(false);
      // Remove from secondary if present
      if (secondaryProductIds.includes(id)) {
        setSecondaryProductIds(prev => prev.filter(pid => pid !== id));
      }
    }
  };

  const handleSecondaryToggle = (id: string) => {
    if (primaryProductId === id) return; // Can't be secondary if primary
    
    setSecondaryProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleBrandCampaignToggle = () => {
    setIsBrandCampaign(!isBrandCampaign);
    if (!isBrandCampaign) {
      setPrimaryProductId(undefined);
      setSecondaryProductIds([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    
    const primaryProduct = products.find(p => p.id === primaryProductId);
    const desc = primaryProduct 
      ? `Campaign for ${primaryProduct.name}`
      : `Brand Campaign: ${campaignName}`;

    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: campaignName,
      description: desc,
      status: 'review', 
      primaryProductId: primaryProductId,
      secondaryProductIds: secondaryProductIds,
      context: context,
      attachments: attachments.map(f => f.name), // Mock storage
      targetAudiences: audiences,
      channels: channels,
      languages: ['en'],
      keyMessage,
      startDate: new Date().toISOString(),
      budget: 0,
      progress: 100
    };

    try {
      const results = await generateMarketingContent(
        newCampaign, 
        products,
        (updatedItem) => {
          if (onUpdateItem) {
             onUpdateItem(updatedItem);
          }
        }
      );
      
      onComplete(newCampaign, results);
      navigate(`/campaigns/${newCampaign.id}`);
      
    } catch (e) {
      console.error(e);
      alert('Generation failed. Please check console.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <div className="mb-8 text-center">
           <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
             <Sparkles size={24} />
           </div>
           <h1 className="text-3xl font-bold text-slate-900 mb-2">Define Campaign Scope</h1>
           <p className="text-slate-500">Select products to feature or create a broad brand campaign.</p>
        </div>

        {/* Brand Campaign Toggle */}
        <div className="mb-8 flex justify-center">
           <button 
             onClick={handleBrandCampaignToggle}
             className={`flex items-center space-x-3 px-6 py-4 rounded-xl border-2 transition-all ${
               isBrandCampaign 
                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                : 'border-slate-200 bg-white hover:border-purple-300'
             }`}
           >
             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isBrandCampaign ? 'border-purple-600' : 'border-slate-300'}`}>
                {isBrandCampaign && <div className="w-3 h-3 rounded-full bg-purple-600" />}
             </div>
             <div className="text-left">
               <div className="font-bold text-slate-900 flex items-center">
                 <Lightbulb size={18} className="mr-2 text-purple-500" />
                 Idea / Brand Campaign
               </div>
               <div className="text-sm text-slate-500">No specific product focus. Best for seasonal or brand awareness.</div>
             </div>
           </button>
        </div>

        {/* Product Grid */}
        <div className={`transition-opacity duration-300 ${isBrandCampaign ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <h2 className="text-lg font-bold text-slate-900 mb-4 px-1">Select Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => {
              const isPrimary = primaryProductId === p.id;
              const isSecondary = secondaryProductIds.includes(p.id);

              return (
                <div 
                  key={p.id}
                  className={`relative p-4 rounded-xl border-2 transition-all bg-white shadow-sm ${
                    isPrimary ? 'border-blue-500 ring-2 ring-blue-200' : 
                    isSecondary ? 'border-indigo-400 bg-indigo-50' :
                    'border-slate-200'
                  }`}
                >
                  <div className="flex items-start space-x-4 mb-3">
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                    <div>
                      <h3 className="font-bold text-slate-900">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.brand}</p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 mt-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => handlePrimarySelect(p.id)}
                      className={`flex items-center space-x-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                        isPrimary 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-blue-50 text-slate-600'
                      }`}
                    >
                       <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isPrimary ? 'border-white' : 'border-slate-400'}`}>
                         {isPrimary && <div className="w-2 h-2 rounded-full bg-white" />}
                       </div>
                       <span>Primary Product</span>
                    </button>

                    <button 
                      onClick={() => handleSecondaryToggle(p.id)}
                      disabled={isPrimary}
                      className={`flex items-center space-x-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                        isSecondary 
                          ? 'bg-indigo-600 text-white' 
                          : isPrimary ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-50 text-slate-600'
                      }`}
                    >
                       <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSecondary ? 'border-white' : 'border-slate-400'}`}>
                         {isSecondary && <CheckCircle2 size={12} />}
                       </div>
                       <span>Secondary Product</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-end">
          <button 
            onClick={() => setStep(2)}
            disabled={!isBrandCampaign && !primaryProductId}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Continue Configuration</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Configuration
  return (
    <div className="max-w-6xl mx-auto pb-10">
      <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center">
        ← Back to Scope
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Strategy Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Campaign Strategy</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. Summer Launch 2024"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Context</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 resize-none"
                    placeholder="Describe the market situation, seasonal event, or specific goal (e.g., 'Competitor just raised prices', 'Holiday Season')..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Key Message / Hook</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Main value prop (e.g. 'Fastest relief on the market')"
                    value={keyMessage}
                    onChange={(e) => setKeyMessage(e.target.value)}
                  />
                </div>

                {/* Attachments */}
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Attachments (Context)</label>
                   <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        multiple 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleFileChange}
                      />
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <Paperclip size={20} className="mb-2" />
                        <span className="text-sm">Click to attach PDFs or guidelines</span>
                      </div>
                   </div>
                   {attachments.length > 0 && (
                     <div className="mt-3 space-y-2">
                       {attachments.map((file, idx) => (
                         <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 text-sm">
                           <div className="flex items-center text-slate-600">
                             <FileText size={14} className="mr-2" />
                             <span className="truncate max-w-[200px]">{file.name}</span>
                           </div>
                           <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500">×</button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Targeting Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Targeting</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  {['HCPs', 'Patients', 'Caregivers', 'General Public'].map(aud => (
                    <button
                      key={aud}
                      onClick={() => setAudiences(prev => prev.includes(aud) ? prev.filter(a => a !== aud) : [...prev, aud])}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        audiences.includes(aud) 
                          ? 'bg-blue-100 text-blue-700 border-blue-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Channels</label>
                <div className="flex flex-wrap gap-2">
                  {['Email', 'LinkedIn', 'Twitter', 'Instagram', 'Web', 'Video Storyboard'].map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        channels.includes(ch) 
                          ? 'bg-purple-100 text-purple-700 border-purple-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl h-full flex flex-col sticky top-4">
              <div className="mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scope</div>
                {isBrandCampaign ? (
                   <div className="p-3 bg-purple-900/50 border border-purple-700/50 rounded-lg text-purple-200 flex items-center">
                     <Lightbulb size={16} className="mr-2" />
                     Brand/Idea Campaign
                   </div>
                ) : (
                  <div className="space-y-2">
                     {primaryProductId && (
                        <div className="flex items-center space-x-3 p-3 bg-blue-900/50 border border-blue-700/50 rounded-lg">
                          <img src={products.find(p => p.id === primaryProductId)?.imageUrl} className="w-8 h-8 rounded object-cover" />
                          <div>
                            <div className="text-[10px] text-blue-300 uppercase">Primary</div>
                            <div className="font-semibold text-sm">{products.find(p => p.id === primaryProductId)?.name}</div>
                          </div>
                        </div>
                     )}
                     {secondaryProductIds.length > 0 && (
                        <div className="p-3 bg-slate-800 rounded-lg">
                          <div className="text-[10px] text-slate-400 uppercase mb-1">Secondary</div>
                          <div className="flex flex-wrap gap-1">
                             {secondaryProductIds.map(id => (
                               <span key={id} className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                                 {products.find(p => p.id === id)?.name}
                               </span>
                             ))}
                          </div>
                        </div>
                     )}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Summary</div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Audiences</span>
                    <span className="text-white font-medium">{audiences.length}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Channels</span>
                    <span className="text-white font-medium">{channels.length}</span>
                  </li>
                  <li className="flex justify-between border-b border-slate-800 pb-2">
                    <span>Attachments</span>
                    <span className="text-white font-medium">{attachments.length}</span>
                  </li>
                </ul>
              </div>

              <button 
                disabled={!campaignName || !keyMessage || isLoading}
                onClick={handleGenerate}
                className="w-full mt-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Generate & View Canvas</span>
                  </>
                )}
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};
