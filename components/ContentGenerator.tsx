
import React, { useState } from 'react';
import {
  Sparkles,
  Paperclip,
  FileText,
  Lightbulb,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Campaign, Product, ComplianceRule } from '../types';

interface ContentGeneratorProps {
  products: Product[];
  complianceRules: ComplianceRule[];
  onComplete: (campaign: Campaign) => void;
}

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({ products, complianceRules, onComplete }) => {
  const navigate = useNavigate();

  // Selection State
  const [primaryProductId, setPrimaryProductId] = useState<string | undefined>(undefined);
  const [secondaryProductIds, setSecondaryProductIds] = useState<string[]>([]);
  const [isBrandCampaign, setIsBrandCampaign] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [context, setContext] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedComplianceRuleId, setSelectedComplianceRuleId] = useState<string | undefined>(undefined);

  const handlePrimarySelect = (id: string) => {
    if (primaryProductId === id) {
      setPrimaryProductId(undefined);
    } else {
      setPrimaryProductId(id);
      setIsBrandCampaign(false);
      if (secondaryProductIds.includes(id)) {
        setSecondaryProductIds(prev => prev.filter(pid => pid !== id));
      }
    }
  };

  const handleSecondaryToggle = (id: string) => {
    if (primaryProductId === id) return;
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

  const canCreate = campaignName.trim() !== '' && (isBrandCampaign || !!primaryProductId);

  const handleCreate = () => {
    const primaryProduct = products.find(p => p.id === primaryProductId);
    const desc = primaryProduct
      ? `Campaign for ${primaryProduct.name}`
      : `Brand Campaign: ${campaignName}`;

    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: campaignName,
      description: desc,
      status: 'draft',
      primaryProductId: primaryProductId,
      secondaryProductIds: secondaryProductIds,
      context: context,
      attachments: attachments.map(f => f.name),
      targetAudiences: [],
      channels: [],
      languages: ['en'],
      keyMessage,
      startDate: new Date().toISOString(),
      budget: 0,
      progress: 0,
      complianceRuleId: selectedComplianceRuleId,
    };

    onComplete(newCampaign);
    navigate(`/campaigns/${newCampaign.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 text-center">
         <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
           <Sparkles size={24} />
         </div>
         <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Campaign</h1>
         <p className="text-slate-500">Set up campaign basics, then configure targeting on the canvas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Campaign Strategy Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Campaign Strategy</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name <span className="text-red-500">*</span></label>
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
                  placeholder="Describe the market situation, seasonal event, or specific goal..."
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
                         <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500">&times;</button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* Product Selection Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Products</h2>

            {/* Brand Campaign Toggle */}
            <div className="mb-6">
               <button
                 onClick={handleBrandCampaignToggle}
                 className={`flex items-center space-x-3 px-5 py-3 rounded-xl border-2 transition-all w-full ${
                   isBrandCampaign
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                 }`}
               >
                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isBrandCampaign ? 'border-purple-600' : 'border-slate-300'}`}>
                    {isBrandCampaign && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                 </div>
                 <div className="text-left">
                   <div className="font-bold text-slate-900 flex items-center text-sm">
                     <Lightbulb size={16} className="mr-2 text-purple-500" />
                     Idea / Brand Campaign
                   </div>
                   <div className="text-xs text-slate-500">No specific product focus.</div>
                 </div>
               </button>
            </div>

            {/* Product Grid */}
            <div className={`transition-opacity duration-300 ${isBrandCampaign ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="flex items-start space-x-3 mb-3">
                        <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
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
          </div>

          {/* Compliance Rules Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
              <ShieldCheck size={20} className="mr-2 text-green-600" />
              Compliance Rule
            </h2>
            {complianceRules.length === 0 ? (
              <div className="text-center py-4 text-sm text-slate-500">
                <p className="mb-2">No compliance rules defined yet.</p>
                <a href="#/compliance-rules" className="text-blue-600 hover:text-blue-700 font-medium">
                  Create compliance rules
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedComplianceRuleId(undefined)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    !selectedComplianceRuleId
                      ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!selectedComplianceRuleId ? 'border-slate-600' : 'border-slate-300'}`}>
                    {!selectedComplianceRuleId && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700">No compliance rule</span>
                </button>
                {complianceRules.map(rule => (
                  <button
                    key={rule.id}
                    onClick={() => setSelectedComplianceRuleId(rule.id)}
                    className={`w-full flex items-start space-x-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
                      selectedComplianceRuleId === rule.id
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                        : 'border-slate-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${selectedComplianceRuleId === rule.id ? 'border-green-600' : 'border-slate-300'}`}>
                      {selectedComplianceRuleId === rule.id && <div className="w-2 h-2 rounded-full bg-green-600" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{rule.name}</div>
                      {rule.description && <div className="text-xs text-slate-500 mt-0.5">{rule.description}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
                   {!primaryProductId && (
                     <div className="p-3 bg-slate-800 rounded-lg text-slate-400 text-sm">
                       No product selected
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Summary</div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <span>Name</span>
                  <span className="text-white font-medium truncate ml-4 max-w-[140px]">{campaignName || '—'}</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <span>Attachments</span>
                  <span className="text-white font-medium">{attachments.length}</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <span>Compliance</span>
                  <span className="text-white font-medium">
                    {selectedComplianceRuleId
                      ? complianceRules.find(r => r.id === selectedComplianceRuleId)?.name || 'Selected'
                      : 'None'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 p-3 bg-slate-800 rounded-lg text-xs text-slate-400 mb-4">
              You'll configure target audiences and channels on the canvas workspace after creation.
            </div>

            <button
              disabled={!canCreate}
              onClick={handleCreate}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
            >
              <Sparkles size={20} />
              <span>Create Campaign</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
