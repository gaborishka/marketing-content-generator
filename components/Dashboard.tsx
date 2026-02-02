import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { DashboardMetrics, ChartData } from '../types';

const mockMetrics: DashboardMetrics = {
  totalCampaigns: 24,
  activeCampaigns: 8,
  generatedAssets: 156,
  avgComplianceScore: 94
};

const activityData: ChartData[] = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 19 },
  { name: 'Wed', value: 15 },
  { name: 'Thu', value: 25 },
  { name: 'Fri', value: 32 },
  { name: 'Sat', value: 10 },
  { name: 'Sun', value: 8 },
];

const complianceData = [
  { name: 'Week 1', value: 88 },
  { name: 'Week 2', value: 91 },
  { name: 'Week 3', value: 94 },
  { name: 'Week 4', value: 96 },
];

const StatCard = ({ label, value, icon: Icon, color, trend }: any) => (
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
    <div className="mt-4 flex items-center text-sm">
      <span className="text-emerald-600 font-medium flex items-center">
        <TrendingUp size={14} className="mr-1" /> {trend}
      </span>
      <span className="text-slate-400 ml-2">vs last month</span>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Overview of your marketing operations.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100">
            System Healthy
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Campaigns" 
          value={mockMetrics.totalCampaigns} 
          icon={FileText} 
          color="bg-blue-500" 
          trend="+12%" 
        />
        <StatCard 
          label="Active Campaigns" 
          value={mockMetrics.activeCampaigns} 
          icon={TrendingUp} 
          color="bg-indigo-500" 
          trend="+5%" 
        />
        <StatCard 
          label="Assets Generated" 
          value={mockMetrics.generatedAssets} 
          icon={CheckCircle2} 
          color="bg-purple-500" 
          trend="+28%" 
        />
        <StatCard 
          label="Compliance Score" 
          value={`${mockMetrics.avgComplianceScore}%`} 
          icon={AlertCircle} 
          color="bg-emerald-500" 
          trend="+2.4%" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Content Generation Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Compliance Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
