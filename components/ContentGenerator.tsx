import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Copy,
  RefreshCw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Campaign, Product, GeneratedContent } from '../types';
import { generateMarketingContent } from '../services/geminiService';

interface ContentGeneratorProps {
  products: Product[];
  onComplete: (campaign: Campaign, content: GeneratedContent[]) => void;
}

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({ products, onComplete }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [audiences, setAudiences] = useState<string[]>(['General']);
  const [channels, setChannels] = useState<string[]>(['Social Media']);
  
  const handleGenerate = async () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setIsLoading(true);
    
    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: campaignName,
      description: `Campaign for ${product.name}`,
      status: 'review', // Go straight to review
      productId: product.id,
      targetAudiences: audiences,
      channels: channels,
      languages: ['en'],
      keyMessage,
      startDate: new Date().toISOString(),
      budget: 0,
      progress: 100
    };

    try {
      const results = await generateMarketingContent(newCampaign, product);
      onComplete(newCampaign, results);
      // Navigate to the canvas view for this new campaign
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
           <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
             <Sparkles size={24} />
           </div>
           <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Campaign Wizard</h1>
           <p className="text-slate-500">Configure your campaign parameters and let Gemini generate high-converting, compliant content.</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Product</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      selectedProductId === p.id 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.brand}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedProductId && (
              <div className="animate-fadeIn">
                <button 
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all transform hover:scale-[1.01]"
                >
                  <span>Continue to Configuration</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Configuration
  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center">
        ← Back to Product Selection
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Key Message / Hook</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 resize-none"
                    placeholder="What is the main value prop you want to convey?"
                    value={keyMessage}
                    onChange={(e) => setKeyMessage(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{keyMessage.length}/200 chars</p>
                </div>
              </div>
            </div>

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
                  {['Email', 'LinkedIn', 'Twitter', 'Instagram', 'Web'].map(ch => (
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
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl h-full flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Selected Product</div>
                <div className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg">
                  {products.find(p => p.id === selectedProductId) && (
                    <>
                      <img src={products.find(p => p.id === selectedProductId)?.imageUrl} className="w-10 h-10 rounded object-cover" />
                      <span className="font-semibold">{products.find(p => p.id === selectedProductId)?.name}</span>
                    </>
                  )}
                </div>
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
                    <span>Est. Variants</span>
                    <span className="text-white font-medium">{audiences.length * channels.length}</span>
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
