import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  ShieldCheck,
  Mail,
  Linkedin,
  Twitter,
  Instagram,
  Globe2,
  Video,
  Facebook,
  Youtube,
  Image as ImageIcon,
  Tv,
  Film,
  Type,
  AlignLeft
} from 'lucide-react';
import { GeneratedContent, getParentChannel } from '../types';

interface ContentDetailModalProps {
  content: GeneratedContent;
  onClose: () => void;
  onSave: (updated: GeneratedContent) => void;
}

const CHANNEL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'Email': { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
  'LinkedIn': { icon: Linkedin, color: 'text-sky-700', bg: 'bg-sky-50' },
  'Twitter': { icon: Twitter, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  'Instagram': { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
  'Web': { icon: Globe2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'TikTok': { icon: Tv, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  'Facebook': { icon: Facebook, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'YouTube': { icon: Youtube, color: 'text-red-600', bg: 'bg-red-50' },
  'Pinterest': { icon: ImageIcon, color: 'text-rose-600', bg: 'bg-rose-50' },
  'Video Storyboard': { icon: Video, color: 'text-violet-600', bg: 'bg-violet-50' },
};

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ content, onClose, onSave }) => {
  const [text, setText] = useState(content.text);
  const [storyboardTexts, setStoryboardTexts] = useState<string[]>(
    content.storyboard?.map(s => s.voiceover) || []
  );
  const parentChannel = getParentChannel(content.channel);
  const isVideoStoryboard = parentChannel === 'Video Storyboard';
  const hasChanges = isVideoStoryboard
    ? content.storyboard?.some((s, i) => s.voiceover !== storyboardTexts[i])
    : text !== content.text;

  const channelCfg = CHANNEL_CONFIG[parentChannel] || { icon: AlignLeft, color: 'text-slate-600', bg: 'bg-slate-50' };
  const ChannelIcon = channelCfg.icon;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = () => {
    if (isVideoStoryboard && content.storyboard) {
      const updatedStoryboard = content.storyboard.map((scene, i) => ({
        ...scene,
        voiceover: storyboardTexts[i] ?? scene.voiceover,
      }));
      onSave({ ...content, storyboard: updatedStoryboard });
    } else {
      onSave({ ...content, text });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${channelCfg.bg}`}>
              <ChannelIcon size={18} className={channelCfg.color} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit Content</h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-xs font-medium text-slate-500">{content.channel}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400">{content.audience}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Image preview */}
          {content.imageUrl && !isVideoStoryboard && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src={content.imageUrl}
                alt="Content asset"
                className="w-full max-h-64 object-cover"
              />
            </div>
          )}

          {/* Video storyboard scenes */}
          {isVideoStoryboard && content.storyboard ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm font-semibold text-slate-700">
                <Film size={16} className="text-violet-500" />
                <span>Storyboard Scenes</span>
              </div>
              {content.storyboard.map((scene, i) => (
                <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  {/* Scene thumbnail */}
                  <div className="w-32 h-20 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>
                  {/* Scene voiceover */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                      Scene {scene.sceneNumber}
                    </div>
                    <textarea
                      value={storyboardTexts[i] ?? ''}
                      onChange={(e) => {
                        const next = [...storyboardTexts];
                        next[i] = e.target.value;
                        setStoryboardTexts(next);
                      }}
                      rows={2}
                      className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Regular text content */
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Type size={14} className="text-slate-400" />
                <label className="text-sm font-semibold text-slate-700">Content Text</label>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all leading-relaxed"
                placeholder="Edit your content text..."
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center space-x-4 pt-2">
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
              content.complianceScore >= 90
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              <ShieldCheck size={12} />
              <span>{content.complianceScore}% Compliance</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
              content.riskLevel === 'low' ? 'bg-green-50 text-green-600 border border-green-100' :
              content.riskLevel === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
              'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {content.riskLevel} risk
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              content.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
              content.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
              'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {content.status}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center space-x-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
