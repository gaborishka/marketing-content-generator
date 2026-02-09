import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CheckCircle, XCircle, Calendar, Filter, Download, RefreshCw } from 'lucide-react';
import { ComplianceRule, Campaign } from '../types';
import { getAllComplianceChecks, ComplianceCheckDoc } from '../services/complianceCheckStorage';
import { getAllAnalytics, AnalyticsDoc } from '../services/analyticsStorage';

interface ComplianceAnalyticsProps {
  rules: ComplianceRule[];
  campaigns: Campaign[];
}

export const ComplianceAnalytics: React.FC<ComplianceAnalyticsProps> = ({ rules, campaigns }) => {
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheckDoc[]>([]);
  const [campaignAnalytics, setCampaignAnalytics] = useState<AnalyticsDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'checks' | 'analytics'>('all');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [checks, analytics] = await Promise.all([
        getAllComplianceChecks(),
        getAllAnalytics(),
      ]);
      setComplianceChecks(checks);
      setCampaignAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Separate individual content checks from campaign-level checks
  const individualChecks = complianceChecks.filter(check => {
    const isContent = check.checkType === 'content';
    if (!isContent) {
      console.log('[ComplianceAnalytics] Check not content type:', check.id, 'checkType:', check.checkType);
    }
    return isContent;
  });
  const campaignChecks = complianceChecks.filter(check => {
    const isCampaign = check.checkType === 'campaign';
    if (!isCampaign) {
      console.log('[ComplianceAnalytics] Check not campaign type:', check.id, 'checkType:', check.checkType);
    }
    return isCampaign;
  });
  
  console.log('[ComplianceAnalytics] Total checks:', complianceChecks.length);
  console.log('[ComplianceAnalytics] Individual checks:', individualChecks.length);
  console.log('[ComplianceAnalytics] Campaign checks:', campaignChecks.length);

  const filteredIndividualChecks = individualChecks.filter(check => {
    if (selectedRuleId !== 'all' && check.ruleId !== selectedRuleId) return false;
    if (selectedCampaignId !== 'all' && check.campaignId !== selectedCampaignId) return false;
    return true;
  });

  const filteredCampaignChecks = campaignChecks.filter(check => {
    if (selectedRuleId !== 'all' && check.ruleId !== selectedRuleId) return false;
    if (selectedCampaignId !== 'all' && check.campaignId !== selectedCampaignId) return false;
    return true;
  });

  const filteredAnalytics = campaignAnalytics.filter(analytics => {
    if (selectedRuleId !== 'all' && analytics.ruleId !== selectedRuleId) return false;
    if (selectedCampaignId !== 'all' && analytics.campaignId !== selectedCampaignId) return false;
    return true;
  });

  // Calculate summary statistics
  const totalChecks = filteredIndividualChecks.length + filteredCampaignChecks.length;
  const totalAnalytics = filteredAnalytics.length;
  const totalItemsChecked = [...filteredIndividualChecks, ...filteredCampaignChecks].reduce((sum, c) => sum + c.total, 0);
  const totalPassed = [...filteredIndividualChecks, ...filteredCampaignChecks].reduce((sum, c) => sum + c.passed, 0);
  const totalFailed = [...filteredIndividualChecks, ...filteredCampaignChecks].reduce((sum, c) => sum + c.failed, 0);
  
  // Calculate pass rate from checks (items checked)
  const overallPassRate = totalItemsChecked > 0 
    ? Math.round((totalPassed / totalItemsChecked) * 100) 
    : 0;

  // Calculate average score from all sources (checks and analytics)
  // Get scores from individual checks
  const checkScores: number[] = [];
  [...filteredIndividualChecks, ...filteredCampaignChecks].forEach(check => {
    check.results?.forEach((result: any) => {
      if (result.score !== undefined) {
        checkScores.push(result.score);
      }
    });
  });
  
  // Get scores from analytics
  const analyticsScores: number[] = [];
  filteredAnalytics.forEach(analytics => {
    analytics.results?.forEach((result: any) => {
      if (result.score !== undefined) {
        analyticsScores.push(result.score);
      }
    });
  });
  
  // Combine all scores
  const allScores = [...checkScores, ...analyticsScores];
  const averageScore = allScores.length > 0
    ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
    : (filteredAnalytics.length > 0
      ? Math.round(filteredAnalytics.reduce((sum, a) => sum + a.averageScore, 0) / filteredAnalytics.length)
      : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Analytics</h1>
          <p className="text-sm text-slate-600 mt-1">View compliance check results and campaign analysis</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Compliance Rule</label>
            <select
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Rules</option>
              {rules.map(rule => (
                <option key={rule.id} value={rule.id}>{rule.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Campaign</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Checks</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalChecks}</p>
            </div>
            <BarChart3 className="text-blue-500" size={24} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Items Checked</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalItemsChecked}</p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{overallPassRate}%</p>
            </div>
            <CheckCircle className="text-green-500" size={24} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Avg Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{averageScore}/100</p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>
      </div>

      {/* Campaign-Level Compliance Checks */}
      {selectedFilter === 'all' && filteredCampaignChecks.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Campaign Compliance Checks</h2>
            <p className="text-sm text-slate-600 mt-1">{filteredCampaignChecks.length} campaign check(s) found</p>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredCampaignChecks.map(check => {
              const rule = rules.find(r => r.id === check.ruleId);
              const campaign = campaigns.find(c => c.id === check.campaignId);
              const passRate = check.total > 0 ? Math.round((check.passed / check.total) * 100) : 0;

              return (
                <div key={check.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-slate-900">{check.ruleName}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          Campaign Check
                        </span>
                      </div>
                      {campaign && (
                        <p className="text-sm text-slate-600 mb-2">Campaign: {campaign.name}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-slate-600">
                          <Calendar size={14} className="inline mr-1" />
                          {new Date(check.checkedAt).toLocaleDateString()}
                        </span>
                        <span className="text-slate-600">
                          {check.total} item(s) checked
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="text-green-600" size={18} />
                          <span className="font-semibold text-green-600">{check.passed}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <XCircle className="text-red-600" size={18} />
                          <span className="font-semibold text-red-600">{check.failed}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{passRate}%</p>
                        <p className="text-xs text-slate-500">Pass Rate</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Content Compliance Checks */}
      {(selectedFilter === 'all' || selectedFilter === 'checks') && filteredIndividualChecks.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Individual Content Checks</h2>
            <p className="text-sm text-slate-600 mt-1">{filteredIndividualChecks.length} check(s) found</p>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredIndividualChecks.map(check => {
              const rule = rules.find(r => r.id === check.ruleId);
              const campaign = campaigns.find(c => c.id === check.campaignId);
              const passRate = check.total > 0 ? Math.round((check.passed / check.total) * 100) : 0;

              return (
                <div key={check.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-slate-900">{check.ruleName}</span>
                        <span className="text-xs px-2 py-1 bg-slate-100 rounded">
                          {check.checkType === 'campaign' ? 'Campaign' : 'Content'}
                        </span>
                      </div>
                      {campaign && (
                        <p className="text-sm text-slate-600 mb-2">Campaign: {campaign.name}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-slate-600">
                          <Calendar size={14} className="inline mr-1" />
                          {new Date(check.checkedAt).toLocaleDateString()}
                        </span>
                        <span className="text-slate-600">
                          {check.total} item(s) checked
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="text-green-600" size={18} />
                          <span className="font-semibold text-green-600">{check.passed}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <XCircle className="text-red-600" size={18} />
                          <span className="font-semibold text-red-600">{check.failed}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{passRate}%</p>
                        <p className="text-xs text-slate-500">Pass Rate</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaign Analytics */}
      {(selectedFilter === 'all' || selectedFilter === 'analytics') && filteredAnalytics.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Campaign Analytics</h2>
            <p className="text-sm text-slate-600 mt-1">{filteredAnalytics.length} analysis result(s) found</p>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredAnalytics.map(analytics => {
              const rule = rules.find(r => r.id === analytics.ruleId);
              const campaign = campaigns.find(c => c.id === analytics.campaignId);
              const passRate = analytics.totalContent > 0 
                ? Math.round((analytics.passed / analytics.totalContent) * 100) 
                : 0;

              return (
                <div key={analytics.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-slate-900">{analytics.ruleName}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          Campaign Analysis
                        </span>
                      </div>
                      {campaign && (
                        <p className="text-sm text-slate-600 mb-2">Campaign: {campaign.name}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-slate-600">
                          <Calendar size={14} className="inline mr-1" />
                          {new Date(analytics.analyzedAt).toLocaleDateString()}
                        </span>
                        <span className="text-slate-600">
                          {analytics.totalContent} content item(s)
                        </span>
                        <span className="text-slate-600">
                          Score: {analytics.minScore}-{analytics.maxScore}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="text-green-600" size={18} />
                          <span className="font-semibold text-green-600">{analytics.passed}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <XCircle className="text-red-600" size={18} />
                          <span className="font-semibold text-red-600">{analytics.failed}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{analytics.averageScore}/100</p>
                        <p className="text-xs text-slate-500">Avg Score</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(() => {
        // Check if we should show empty state based on selected filter
        let shouldShowEmpty = false;
        let emptyMessage = "Run compliance checks or campaign analysis to see results here.";
        
        if (selectedFilter === 'all') {
          shouldShowEmpty = filteredIndividualChecks.length === 0 && filteredCampaignChecks.length === 0 && filteredAnalytics.length === 0;
        } else if (selectedFilter === 'checks') {
          shouldShowEmpty = filteredIndividualChecks.length === 0;
          emptyMessage = "No individual content checks found. Run a compliance check on specific content items to see results here.";
        } else if (selectedFilter === 'analytics') {
          shouldShowEmpty = filteredAnalytics.length === 0;
          emptyMessage = "No campaign analytics found. Run campaign analysis to see results here.";
        }
        
        return shouldShowEmpty ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <BarChart3 className="mx-auto text-slate-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Data Found</h3>
            <p className="text-slate-600">
              {emptyMessage}
            </p>
          </div>
        ) : null;
      })()}
    </div>
  );
};

