
import React from 'react';
import { Plus, MoreVertical, Calendar, BarChart2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Campaign } from '../types';

interface CampaignListProps {
  campaigns: Campaign[];
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    generating: 'bg-blue-100 text-blue-700 animate-pulse',
    review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    published: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

export const CampaignList: React.FC<CampaignListProps> = ({ campaigns }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500">Create, manage and publish your marketing campaigns.</p>
        </div>
        <Link to="/campaigns/new" className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
          <Plus size={18} />
          <span>New Campaign</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Channels</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((campaign) => (
                <tr 
                  key={campaign.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                        {campaign.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{campaign.name}</div>
                        <div className="text-xs text-slate-500">{campaign.keyMessage.substring(0, 30)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {campaign.primaryProductId ? (
                       <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Product</span>
                     ) : (
                       <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">Brand/Idea</span>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                       {campaign.channels.map((ch, i) => (
                         <div key={i} className="h-6 w-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] text-slate-600 shadow-sm z-10" title={ch}>
                           {ch[0]}
                         </div>
                       ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full max-w-[120px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">{campaign.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${campaign.progress}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="flex items-center">
                      <Calendar size={14} className="mr-1.5 opacity-70" />
                      {new Date(campaign.startDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No campaigns found. Create your first campaign to get started.
          </div>
        )}
      </div>
    </div>
  );
};
