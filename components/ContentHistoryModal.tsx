import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  GitBranch,
  Sparkles,
  Copy,
  FileText,
  Trash2,
  Move,
  Edit,
  ChevronRight,
  ChevronDown,
  Loader2,
  Clock
} from 'lucide-react';
import { GeneratedContent } from '../types';
import { ContentChange, ChangeType, getCampaignHistory, groupHistoryByContent } from '../services/contentHistoryService';

interface ContentHistoryModalProps {
  campaignId: string;
  contentItems: GeneratedContent[];
  onClose: () => void;
  onRollback: (contentId: string, version: GeneratedContent) => void;
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  generated: { label: 'Generated', icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-50' },
  pasted: { label: 'Pasted', icon: Copy, color: 'text-green-600', bg: 'bg-green-50' },
  imported: { label: 'Imported', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  ai_modified: { label: 'AI Modified', icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  manual_edit: { label: 'Manual Edit', icon: Edit, color: 'text-amber-600', bg: 'bg-amber-50' },
  deleted: { label: 'Deleted', icon: Trash2, color: 'text-red-600', bg: 'bg-red-50' },
  moved: { label: 'Moved', icon: Move, color: 'text-slate-600', bg: 'bg-slate-50' },
};

export const ContentHistoryModal: React.FC<ContentHistoryModalProps> = ({
  campaignId,
  contentItems,
  onClose,
  onRollback
}) => {
  const [history, setHistory] = useState<ContentChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedChange, setSelectedChange] = useState<ContentChange | null>(null);

  useEffect(() => {
    loadHistory();
  }, [campaignId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const changes = await getCampaignHistory(campaignId);
      setHistory(changes);
      // Expand first item by default
      if (changes.length > 0) {
        setExpandedItems(new Set([changes[0].contentId]));
      }
    } catch (error: any) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (contentId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const handleRollback = (change: ContentChange) => {
    if (change.previousVersion) {
      onRollback(change.contentId, change.previousVersion);
      onClose();
    }
  };

  const groupedHistory = groupHistoryByContent(history);
  const contentMap = new Map(contentItems.map(item => [item.id, item]));

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Content History</h2>
              <p className="text-sm text-slate-500">View and restore previous versions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : groupedHistory.size === 0 ? (
            <div className="text-center py-12">
              <GitBranch size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedHistory.entries()).map(([contentId, changes]) => {
                const currentContent = contentMap.get(contentId);
                const isExpanded = expandedItems.has(contentId);
                const ChangeIcon = changes[0] ? CHANGE_TYPE_CONFIG[changes[0].changeType]?.icon || FileText : FileText;

                return (
                  <div key={contentId} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Content Item Header */}
                    <button
                      onClick={() => toggleExpand(contentId)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <ChangeIcon size={16} className="text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {currentContent?.channel || 'Unknown Channel'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {currentContent?.audience || 'Unknown Audience'} • {changes.length} change{changes.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                    </button>

                    {/* Change List */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50">
                        {changes.map((change, idx) => {
                          const config = CHANGE_TYPE_CONFIG[change.changeType] || CHANGE_TYPE_CONFIG.generated;
                          const Icon = config.icon;
                          const isSelected = selectedChange?.id === change.id;
                          const canRollback = change.previousVersion && idx < changes.length - 1; // Can't rollback the first (newest) version

                          return (
                            <div
                              key={change.id}
                              className={`border-b border-slate-200 last:border-b-0 ${
                                isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                              } transition-colors`}
                            >
                              <div className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <div className={`p-1.5 rounded ${config.bg}`}>
                                      <Icon size={14} className={config.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-xs font-semibold text-slate-700">{config.label}</span>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">{formatTime(change.timestamp)}</span>
                                      </div>
                                      <p className="text-sm text-slate-600 mb-2">{change.description}</p>
                                      {change.metadata?.aiPrompt && (
                                        <div className="text-xs text-slate-500 bg-slate-100 rounded px-2 py-1 mb-2">
                                          <span className="font-medium">AI Prompt:</span> {change.metadata.aiPrompt}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => setSelectedChange(isSelected ? null : change)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                      >
                                        {isSelected ? 'Hide' : 'View'} details
                                      </button>
                                    </div>
                                  </div>
                                  {canRollback && (
                                    <button
                                      onClick={() => handleRollback(change)}
                                      className="ml-4 flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                      <RotateCcw size={12} />
                                      <span>Rollback</span>
                                    </button>
                                  )}
                                </div>

                                {/* Change Details */}
                                {isSelected && (
                                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                    {change.previousVersion && (
                                      <div>
                                        <div className="text-xs font-semibold text-slate-500 mb-1">Previous Version</div>
                                        <div className="text-xs text-slate-600 bg-red-50 border border-red-100 rounded p-2">
                                          <div className="font-medium mb-1">Text:</div>
                                          <div className="whitespace-pre-wrap line-clamp-3">{change.previousVersion.text}</div>
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-xs font-semibold text-slate-500 mb-1">New Version</div>
                                      <div className="text-xs text-slate-600 bg-green-50 border border-green-100 rounded p-2">
                                        <div className="font-medium mb-1">Text:</div>
                                        <div className="whitespace-pre-wrap line-clamp-3">{change.newVersion.text}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

