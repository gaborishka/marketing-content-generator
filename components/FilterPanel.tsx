
import React, { forwardRef } from 'react';
import { X, Check } from 'lucide-react';
import { GeneratedContent, getParentChannel } from '../types';

export interface ContentFilters {
  channels: Set<string>;
  audiences: Set<string>;
  statuses: Set<string>;
  complianceMin: number;
}

export const INITIAL_FILTERS: ContentFilters = {
  channels: new Set(),
  audiences: new Set(),
  statuses: new Set(),
  complianceMin: 0,
};

interface FilterPanelProps {
  filters: ContentFilters;
  onFiltersChange: (filters: ContentFilters) => void;
  onClearAll: () => void;
  onClose: () => void;
  campaignContent: GeneratedContent[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  generating: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export const FilterPanel = forwardRef<HTMLDivElement, FilterPanelProps>(
  ({ filters, onFiltersChange, onClearAll, onClose, campaignContent }, ref) => {

    // Derive available values + counts from actual content
    const channelCounts = new Map<string, number>();
    const audienceCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();

    for (const item of campaignContent) {
      const parent = getParentChannel(item.channel);
      channelCounts.set(parent, (channelCounts.get(parent) || 0) + 1);
      audienceCounts.set(item.audience, (audienceCounts.get(item.audience) || 0) + 1);
      statusCounts.set(item.status, (statusCounts.get(item.status) || 0) + 1);
    }

    const channels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
    const audiences = [...audienceCounts.entries()].sort((a, b) => b[1] - a[1]);
    const statuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);

    const toggleSet = (set: Set<string>, value: string): Set<string> => {
      const next = new Set(set);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    };

    return (
      <div
        ref={ref}
        className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Filter Content</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {/* Channel Section */}
          {channels.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Channel</div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {channels.map(([channel, count]) => {
                  const isSelected = filters.channels.has(channel);
                  return (
                    <div
                      key={channel}
                      onClick={() => onFiltersChange({ ...filters, channels: toggleSet(filters.channels, channel) })}
                      className="flex items-center justify-between py-1 px-1 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-sm text-slate-700">{channel}</span>
                      </div>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audience Section */}
          {audiences.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Audience</div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {audiences.map(([audience, count]) => {
                  const isSelected = filters.audiences.has(audience);
                  return (
                    <div
                      key={audience}
                      onClick={() => onFiltersChange({ ...filters, audiences: toggleSet(filters.audiences, audience) })}
                      className="flex items-center justify-between py-1 px-1 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-sm text-slate-700">{audience}</span>
                      </div>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Section */}
          {statuses.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Status</div>
              <div className="space-y-1">
                {statuses.map(([status, count]) => {
                  const isSelected = filters.statuses.has(status);
                  const colors = STATUS_COLORS[status] || STATUS_COLORS.draft;
                  return (
                    <div
                      key={status}
                      onClick={() => onFiltersChange({ ...filters, statuses: toggleSet(filters.statuses, status) })}
                      className="flex items-center justify-between py-1 px-1 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compliance Score Section */}
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Compliance Score</div>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={filters.complianceMin}
                onChange={(e) =>
                  onFiltersChange({ ...filters, complianceMin: Number(e.target.value) })
                }
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs font-medium text-slate-600 w-14 text-right">
                {filters.complianceMin === 0 ? 'Any' : `≥ ${filters.complianceMin}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }
);

FilterPanel.displayName = 'FilterPanel';
