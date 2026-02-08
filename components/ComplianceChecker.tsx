import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle, AlertCircle, Loader2, X, FileText, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ComplianceRule, Campaign, GeneratedContent } from '../types';
import { checkCompliance } from '../services/orchestrationService';
import { ComplianceCheckResult } from '../services/geminiClient';
import { getAll } from '../services/storageService';

interface ComplianceCheckerProps {
  rules: ComplianceRule[];
  campaigns?: Campaign[];
  contentItems?: GeneratedContent[];
  onCheckComplete?: (results: ComplianceCheckResult[]) => void;
}

export const ComplianceChecker: React.FC<ComplianceCheckerProps> = ({
  rules,
  campaigns = [],
  contentItems = [],
  onCheckComplete,
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [checkMode, setCheckMode] = useState<'campaign' | 'content'>('campaign');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<ComplianceCheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCheck = async () => {
    if (!selectedRuleId) {
      setError('Please select a compliance rule');
      return;
    }

    if (!selectedCampaignId) {
      setError('Please select a campaign');
      return;
    }

    if (checkMode === 'content' && selectedContentIds.size === 0) {
      setError('Please select at least one content item');
      return;
    }

    setIsChecking(true);
    setError(null);
    setResults(null);

    try {
      // Get the selected rule
      const selectedRule = rules.find(r => r.id === selectedRuleId);
      if (!selectedRule) {
        setError('Selected compliance rule not found');
        setIsChecking(false);
        return;
      }

      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      
      const response = await checkCompliance(
        selectedRuleId,
        {
          campaignId: selectedCampaignId,
          campaignName: selectedCampaign?.name,
          contentIds: checkMode === 'content' ? Array.from(selectedContentIds) : undefined,
        },
        selectedRule.ruleText,
        selectedRule.name
      );

      if (!response.success) {
        setError('Compliance check failed');
        return;
      }

      setResults(response.results);
      onCheckComplete?.(response.results);
    } catch (err: any) {
      setError(err.message || 'Failed to check compliance');
    } finally {
      setIsChecking(false);
    }
  };

  const toggleContentItem = (id: string) => {
    setSelectedContentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!results || results.length === 0) return;

    setIsSaving(true);
    try {
      // Results are already saved by checkCompliance function
      // Just redirect to analytics page
      navigate('/compliance-analytics');
    } catch (err: any) {
      setError(err.message || 'Failed to save results');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRule = rules.find(r => r.id === selectedRuleId);
  const passedCount = results?.filter(r => r.pass).length || 0;
  const failedCount = results?.filter(r => !r.pass).length || 0;
  const totalCount = results?.length || 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
      >
        <ShieldCheck size={18} />
        <span>Check Compliance</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Compliance Check</h2>
                <p className="text-sm text-slate-500 mt-1">Check existing content against compliance rules</p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setResults(null);
                  setError(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Rule Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Compliance Rule *</label>
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a rule...</option>
                  {rules.map(rule => (
                    <option key={rule.id} value={rule.id}>{rule.name}</option>
                  ))}
                </select>
                {selectedRule && (
                  <p className="text-xs text-slate-500 mt-1">{selectedRule.description}</p>
                )}
              </div>

              {/* Check Mode */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Check Mode</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="campaign"
                      checked={checkMode === 'campaign'}
                      onChange={(e) => setCheckMode(e.target.value as 'campaign')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Entire Campaign</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="content"
                      checked={checkMode === 'content'}
                      onChange={(e) => setCheckMode(e.target.value as 'content')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Selected Content Items</span>
                  </label>
                </div>
              </div>

              {/* Campaign Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Campaign *</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value);
                    setSelectedContentIds(new Set()); // Clear selected content when campaign changes
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>

              {/* Content Selection */}
              {checkMode === 'content' && selectedCampaignId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Content Items from Campaign ({selectedContentIds.size} selected)
                  </label>
                  {(() => {
                    const campaignContent = contentItems.filter(item => item.campaignId === selectedCampaignId);
                    if (campaignContent.length === 0) {
                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                          <p className="text-sm text-slate-500">No content items available for this campaign</p>
                        </div>
                      );
                    }
                    return (
                      <div className="border border-slate-300 rounded-lg max-h-60 overflow-y-auto">
                        {campaignContent.map(item => (
                          <label
                            key={item.id}
                            className="flex items-start space-x-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-200 last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedContentIds.has(item.id)}
                              onChange={() => toggleContentItem(item.id)}
                              className="mt-1 w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-slate-900">{item.channel}</span>
                                <span className="text-xs text-slate-500">•</span>
                                <span className="text-sm text-slate-600">{item.audience}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.text}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {checkMode === 'content' && !selectedCampaignId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">Please select a campaign first to view its content items</p>
                </div>
              )}


              {checkMode === 'content' && contentItems.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-500">No content items available to check</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Results Summary */}
              {results && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Check Results</h3>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 text-green-700">
                        <CheckCircle size={16} />
                        <span>{passedCount} Passed</span>
                      </div>
                      <div className="flex items-center space-x-1 text-red-700">
                        <XCircle size={16} />
                        <span>{failedCount} Failed</span>
                      </div>
                      <span className="text-slate-500">{totalCount} Total</span>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map(result => {
                      const contentItem = contentItems.find(c => c.id === result.contentId);
                      return (
                        <div
                          key={result.contentId}
                          className={`bg-white rounded-lg p-4 border ${
                            result.pass ? 'border-green-200' : 'border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              {contentItem && (
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-sm font-medium text-slate-900">{contentItem.channel}</span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-sm text-slate-600">{contentItem.audience}</span>
                                </div>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {contentItem?.text || result.contentId}
                              </p>
                            </div>
                            <div className={`flex items-center space-x-1 ml-4 ${
                              result.pass ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {result.pass ? <CheckCircle size={18} /> : <XCircle size={18} />}
                              <span className="font-semibold">{result.score}/100</span>
                            </div>
                          </div>

                          {!result.pass && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <div className="mb-2">
                                <p className="text-xs font-medium text-slate-700 mb-1">Violations:</p>
                                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                  {result.violations.map((violation, idx) => (
                                    <li key={idx}>{violation}</li>
                                  ))}
                                </ul>
                              </div>
                              {result.suggestedFix && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-slate-700 mb-1">Suggested Fix:</p>
                                  <p className="text-xs text-slate-600 bg-blue-50 p-2 rounded">{result.suggestedFix}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {result.feedback && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-500 italic">{result.feedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setResults(null);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {results ? 'Close' : 'Cancel'}
                </button>
                {results ? (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Results</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleCheck}
                    disabled={isChecking || !selectedRuleId}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Run Check</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

