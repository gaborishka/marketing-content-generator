import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Megaphone, ShieldCheck, AlertTriangle, FileText,
  Zap, Plus, ArrowRight, Package
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Campaign, GeneratedContent, Product, UsageInfo, getParentChannel } from '../types';

interface DashboardProps {
  campaigns: Campaign[];
  contentStore: GeneratedContent[];
  products: Product[];
  usageInfo: UsageInfo | null;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    generating: 'bg-blue-100 text-blue-700 animate-pulse',
    review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    published: 'bg-purple-100 text-purple-700',
    paused: 'bg-orange-100 text-orange-700',
    completed: 'bg-slate-200 text-slate-600',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

const StatCard = ({ label, value, subtitle, icon: Icon, color }: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
    <div className="mt-4">
      <span className="text-sm text-slate-500">{subtitle}</span>
    </div>
  </div>
);

const ChartCard = ({ title, children, isEmpty }: { title: string; children: React.ReactNode; isEmpty?: boolean }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <h3 className="text-lg font-bold text-slate-900 mb-6">{title}</h3>
    <div className="h-64">
      {isEmpty ? (
        <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data yet</div>
      ) : (
        children
      )}
    </div>
  </div>
);

const tooltipStyle = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };

export const Dashboard: React.FC<DashboardProps> = ({ campaigns, contentStore, products, usageInfo }) => {
  // Stat card values
  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter(c =>
      ['generating', 'review', 'published'].includes(c.status)
    ).length;

    const approvedContent = contentStore.filter(c => c.status === 'approved').length;

    const scores = contentStore.map(c => c.complianceScore).filter(s => s != null && s > 0);
    const avgCompliance = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const highRisk = contentStore.filter(c => c.riskLevel === 'high').length;
    const mediumRisk = contentStore.filter(c => c.riskLevel === 'medium').length;

    return { activeCampaigns, approvedContent, avgCompliance, highRisk, mediumRisk };
  }, [campaigns, contentStore]);

  // Chart 1: Campaign status distribution
  const campaignStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ name: status, value: count }));
  }, [campaigns]);

  const campaignStatusColors: Record<string, string> = {
    draft: '#94a3b8', generating: '#3b82f6', review: '#f59e0b',
    approved: '#10b981', published: '#8b5cf6', paused: '#f97316', completed: '#475569'
  };

  // Chart 2: Content by channel
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    contentStore.forEach(c => {
      const parent = getParentChannel(c.channel);
      counts[parent] = (counts[parent] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [contentStore]);

  // Chart 3: Compliance score distribution
  const complianceDistData = useMemo(() => {
    const buckets = [
      { name: '0-59', min: 0, max: 59, count: 0, color: '#ef4444' },
      { name: '60-69', min: 60, max: 69, count: 0, color: '#f97316' },
      { name: '70-79', min: 70, max: 79, count: 0, color: '#f59e0b' },
      { name: '80-89', min: 80, max: 89, count: 0, color: '#84cc16' },
      { name: '90-100', min: 90, max: 100, count: 0, color: '#10b981' },
    ];
    contentStore.forEach(c => {
      if (c.complianceScore == null) return;
      const bucket = buckets.find(b => c.complianceScore >= b.min && c.complianceScore <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map(b => ({ name: b.name, value: b.count, color: b.color }));
  }, [contentStore]);

  // Chart 4: Content status breakdown
  const contentStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    contentStore.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ name: status, value: count }));
  }, [contentStore]);

  const contentStatusColors: Record<string, string> = {
    draft: '#94a3b8', approved: '#10b981', rejected: '#ef4444', generating: '#3b82f6'
  };

  // Recent campaigns (up to 5, newest first)
  const recentCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 5);
  }, [campaigns]);

  // Usage quota
  const usagePercent = usageInfo ? Math.round((usageInfo.generationCount / usageInfo.limit) * 100) : 0;
  const usageBarColor = usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Overview of your marketing operations.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Campaigns"
          value={campaigns.length}
          subtitle={`${stats.activeCampaigns} active`}
          icon={Megaphone}
          color="bg-blue-500"
        />
        <StatCard
          label="Assets Generated"
          value={contentStore.length}
          subtitle={`${stats.approvedContent} approved`}
          icon={FileText}
          color="bg-purple-500"
        />
        <StatCard
          label="Avg Compliance"
          value={contentStore.length > 0 ? `${stats.avgCompliance}%` : '—'}
          subtitle={contentStore.length > 0 ? (
            stats.avgCompliance >= 90 ? 'Excellent' : stats.avgCompliance >= 70 ? 'Needs attention' : 'At risk'
          ) : 'No content yet'}
          icon={ShieldCheck}
          color="bg-emerald-500"
        />
        <StatCard
          label="Content at Risk"
          value={stats.highRisk + stats.mediumRisk}
          subtitle={`${stats.highRisk} high / ${stats.mediumRisk} medium`}
          icon={AlertTriangle}
          color="bg-amber-500"
        />
      </div>

      {/* Usage Quota Banner */}
      {usageInfo && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-blue-500" />
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
              usageInfo.tier === 'pro' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {usageInfo.tier}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-600">
                {usageInfo.generationCount} of {usageInfo.limit} generations used today
              </span>
              <span className="text-sm font-medium text-slate-700">{usagePercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${usageBarColor}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
          {usageInfo.tier === 'free' && (
            <Link
              to="/settings"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </Link>
        <Link
          to="/campaigns"
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowRight size={16} />
          View All Campaigns
        </Link>
        <Link
          to="/products"
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
        >
          <Package size={16} />
          Manage Products
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Campaign Status Distribution" isEmpty={campaignStatusData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} allowDecimals={false} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} width={80} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {campaignStatusData.map((entry) => (
                  <Cell key={entry.name} fill={campaignStatusColors[entry.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Content by Channel" isEmpty={channelData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Compliance Score Distribution" isEmpty={contentStore.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={complianceDistData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {complianceDistData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Content Status Breakdown" isEmpty={contentStatusData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={contentStatusData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {contentStatusData.map((entry) => (
                  <Cell key={entry.name} fill={contentStatusColors[entry.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recent Campaigns Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Recent Campaigns</h3>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 mb-2">No campaigns yet.</p>
            <Link to="/campaigns/new" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assets</th>
                  <th className="px-6 py-3">Compliance</th>
                  <th className="px-6 py-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCampaigns.map(campaign => {
                  const assetCount = contentStore.filter(c => c.campaignId === campaign.id).length;
                  const campaignContentScores = contentStore
                    .filter(c => c.campaignId === campaign.id && c.complianceScore > 0)
                    .map(c => c.complianceScore);
                  const avgScore = campaign.complianceScore
                    ?? (campaignContentScores.length > 0
                      ? Math.round(campaignContentScores.reduce((a, b) => a + b, 0) / campaignContentScores.length)
                      : null);
                  const scoreColor = avgScore == null ? 'text-slate-400'
                    : avgScore >= 90 ? 'text-emerald-600'
                    : avgScore >= 70 ? 'text-amber-600' : 'text-red-600';

                  return (
                    <tr key={campaign.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <Link to={`/campaigns/${campaign.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {campaign.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{assetCount}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${scoreColor}`}>
                          {avgScore != null ? `${avgScore}%` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${campaign.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{campaign.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
