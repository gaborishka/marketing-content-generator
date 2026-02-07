import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Plus,
  Type,
  ImageIcon,
  Upload,
  Mail,
  Linkedin,
  Twitter,
  Instagram,
  Globe2,
  Video,
  Facebook,
  Youtube,
  Image as LucideImage,
  Tv,
  AlignLeft,
  Users,
  Stethoscope,
  Heart,
  GraduationCap,
  Globe,
  Baby,
  Pill,
  Building2,
  UserCircle,
  ChevronDown,
  Film,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { GeneratedContent, Scene, CHANNEL_FORMATS, getParentChannel } from '../types';

interface ContentCreationModalProps {
  campaignId: string;
  onClose: () => void;
  onCreate: (content: GeneratedContent) => void;
  initialText?: string;
  initialImageDataUrl?: string;
  canvasPosition: { x: number; y: number };
  existingChannels: string[];
  existingAudiences: string[];
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  'Email': Mail,
  'LinkedIn': Linkedin,
  'Twitter': Twitter,
  'Instagram': Instagram,
  'Web': Globe2,
  'TikTok': Tv,
  'Facebook': Facebook,
  'YouTube': Youtube,
  'Pinterest': LucideImage,
  'Video Storyboard': Video,
};

const CHANNEL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'Email': { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'LinkedIn': { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  'Twitter': { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'Instagram': { text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  'Web': { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'TikTok': { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  'Facebook': { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'YouTube': { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'Pinterest': { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Video Storyboard': { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
};

const AUDIENCE_ICONS: Record<string, React.ElementType> = {
  'Healthcare Professionals': Stethoscope,
  'Patients': Heart,
  'Caregivers': Users,
  'General Public': Globe,
  'Students': GraduationCap,
  'Seniors': UserCircle,
  'Parents': Baby,
  'Pharmacists': Pill,
  'Hospital Administrators': Building2,
};

// Build flat list of all sub-formats grouped by parent
const ALL_SUBFORMATS: { parent: string; format: string }[] = [];
for (const [parent, formats] of Object.entries(CHANNEL_FORMATS)) {
  for (const fmt of formats) {
    ALL_SUBFORMATS.push({ parent, format: fmt });
  }
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type SceneWithKey = Scene & { _key: string };

export const ContentCreationModal: React.FC<ContentCreationModalProps> = ({
  campaignId,
  onClose,
  onCreate,
  initialText = '',
  initialImageDataUrl = '',
  canvasPosition,
  existingChannels,
  existingAudiences,
}) => {
  const [text, setText] = useState(initialText);
  const [imageDataUrl, setImageDataUrl] = useState(initialImageDataUrl);
  const [selectedChannel, setSelectedChannel] = useState(existingChannels[0] || 'LinkedIn Post');
  const [selectedAudience, setSelectedAudience] = useState(existingAudiences[0] || 'General Public');
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const sceneKeyCounter = useRef(3);
  const [scenes, setScenes] = useState<SceneWithKey[]>([
    { _key: '1', sceneNumber: 1, imagePrompt: '', voiceover: '' },
    { _key: '2', sceneNumber: 2, imagePrompt: '', voiceover: '' },
    { _key: '3', sceneNumber: 3, imagePrompt: '', voiceover: '' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const channelDropdownRef = useRef<HTMLDivElement>(null);

  const isVideoStoryboard = getParentChannel(selectedChannel) === 'Video Storyboard';

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Close channel dropdown on outside click
  useEffect(() => {
    if (!isChannelDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setIsChannelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChannelDropdownOpen]);

  const validateImageSize = useCallback((file: File): boolean => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`);
      return false;
    }
    setImageError(null);
    return true;
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (!validateImageSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (!validateImageSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleUpdateScene = (index: number, field: 'imagePrompt' | 'voiceover', value: string) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleAddScene = () => {
    sceneKeyCounter.current += 1;
    setScenes(prev => [...prev, { _key: String(sceneKeyCounter.current), sceneNumber: prev.length + 1, imagePrompt: '', voiceover: '' }]);
  };

  const handleRemoveScene = (index: number) => {
    setScenes(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sceneNumber: i + 1 })));
  };

  const handleCreate = () => {
    if (isVideoStoryboard) {
      const validScenes = scenes.filter(s => s.voiceover.trim() || s.imagePrompt.trim());
      if (validScenes.length === 0) return;

      // Strip internal _key before persisting
      const cleanScenes: Scene[] = validScenes.map(({ _key, ...rest }) => rest);

      const newContent: GeneratedContent = {
        id: `manual-${crypto.randomUUID()}`,
        campaignId,
        channel: selectedChannel,
        audience: selectedAudience,
        text: text.trim() || cleanScenes.map(s => s.voiceover).join(' | '),
        complianceScore: 0,
        status: 'draft',
        riskLevel: 'low',
        x: canvasPosition.x,
        y: canvasPosition.y,
        width: 320,
        storyboard: cleanScenes,
        videoStatus: 'idle',
      };
      onCreate(newContent);
    } else {
      if (!text.trim() && !imageDataUrl) return;

      const newContent: GeneratedContent = {
        id: `manual-${crypto.randomUUID()}`,
        campaignId,
        channel: selectedChannel,
        audience: selectedAudience,
        text: text.trim(),
        imageUrl: imageDataUrl || undefined,
        complianceScore: 0,
        status: 'draft',
        riskLevel: 'low',
        x: canvasPosition.x,
        y: canvasPosition.y,
        width: 320,
      };
      onCreate(newContent);
    }
    onClose();
  };

  const parentChannel = getParentChannel(selectedChannel);
  const channelColor = CHANNEL_COLORS[parentChannel] || { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  const ChannelIcon = CHANNEL_ICONS[parentChannel] || AlignLeft;

  const canCreate = isVideoStoryboard
    ? scenes.some(s => s.voiceover.trim() || s.imagePrompt.trim())
    : (text.trim().length > 0 || !!imageDataUrl);

  // Group channels: prioritize those already in the campaign, then all others
  const campaignFormats = ALL_SUBFORMATS.filter(sf => existingChannels.includes(sf.format));
  const otherFormats = ALL_SUBFORMATS.filter(sf => !existingChannels.includes(sf.format));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Plus size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Content</h2>
              <p className="text-xs text-slate-400 mt-0.5">Create a content card manually</p>
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
          {/* Channel & Audience Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Channel Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Channel / Format</label>
              <div className="relative" ref={channelDropdownRef}>
                <button
                  onClick={() => setIsChannelDropdownOpen(!isChannelDropdownOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${channelColor.bg} ${channelColor.border} ${channelColor.text}`}
                >
                  <div className="flex items-center space-x-2">
                    <ChannelIcon size={16} />
                    <span>{selectedChannel}</span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${isChannelDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isChannelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                    {campaignFormats.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 sticky top-0">
                          Campaign Channels
                        </div>
                        {campaignFormats.map(({ parent, format }) => {
                          const Icon = CHANNEL_ICONS[parent] || AlignLeft;
                          const color = CHANNEL_COLORS[parent] || { text: 'text-slate-600', bg: 'bg-slate-50' };
                          return (
                            <button
                              key={format}
                              onClick={() => { setSelectedChannel(format); setIsChannelDropdownOpen(false); }}
                              className={`w-full flex items-center space-x-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                selectedChannel === format ? `${color.bg} font-semibold` : ''
                              }`}
                            >
                              <Icon size={14} className={color.text} />
                              <span className="text-slate-700">{format}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                    {otherFormats.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 sticky top-0">
                          All Channels
                        </div>
                        {otherFormats.map(({ parent, format }) => {
                          const Icon = CHANNEL_ICONS[parent] || AlignLeft;
                          const color = CHANNEL_COLORS[parent] || { text: 'text-slate-600', bg: 'bg-slate-50' };
                          return (
                            <button
                              key={format}
                              onClick={() => { setSelectedChannel(format); setIsChannelDropdownOpen(false); }}
                              className={`w-full flex items-center space-x-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                selectedChannel === format ? `${color.bg} font-semibold` : ''
                              }`}
                            >
                              <Icon size={14} className={color.text} />
                              <span className="text-slate-700">{format}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Audience Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Target Audience</label>
              <div className="flex flex-wrap gap-1.5">
                {/* Show campaign audiences first, then a few extras */}
                {(() => {
                  const allAudiences = [
                    ...existingAudiences,
                    ...Object.keys(AUDIENCE_ICONS).filter(a => !existingAudiences.includes(a)),
                  ];
                  return allAudiences.map(aud => {
                    const Icon = AUDIENCE_ICONS[aud] || Users;
                    const isSelected = selectedAudience === aud;
                    const isCampaignAudience = existingAudiences.includes(aud);
                    return (
                      <button
                        key={aud}
                        onClick={() => setSelectedAudience(aud)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200 shadow-sm'
                            : isCampaignAudience
                              ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-500'
                        }`}
                      >
                        <Icon size={11} />
                        <span>{aud}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {isVideoStoryboard ? (
            /* Video Storyboard Scenes */
            <>
              {/* Optional description */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Film size={14} className="text-violet-500" />
                  <label className="text-xs font-semibold text-slate-500 uppercase">Storyboard Description (optional)</label>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none transition-all leading-relaxed"
                  placeholder="Brief description of this storyboard..."
                />
              </div>

              {/* Scene List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Film size={14} className="text-violet-500" />
                    <label className="text-xs font-semibold text-slate-500 uppercase">Scenes</label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{scenes.length}</span>
                  </div>
                  <button
                    onClick={handleAddScene}
                    className="flex items-center space-x-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    <PlusCircle size={13} />
                    <span>Add Scene</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {scenes.map((scene, index) => (
                    <div key={scene._key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                          Scene {scene.sceneNumber}
                        </span>
                        {scenes.length > 1 && (
                          <button
                            onClick={() => handleRemoveScene(index)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Voiceover</label>
                          <textarea
                            value={scene.voiceover}
                            onChange={(e) => handleUpdateScene(index, 'voiceover', e.target.value)}
                            rows={2}
                            className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none transition-all"
                            placeholder="Narration for this scene..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Image Prompt</label>
                          <input
                            type="text"
                            value={scene.imagePrompt}
                            onChange={(e) => handleUpdateScene(index, 'imagePrompt', e.target.value)}
                            className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                            placeholder="Describe the visual for this scene..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Regular Content: Text + Image */
            <>
              {/* Text Content */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Type size={14} className="text-slate-400" />
                  <label className="text-xs font-semibold text-slate-500 uppercase">Content Text</label>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  autoFocus={!initialText && !initialImageDataUrl}
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all leading-relaxed"
                  placeholder="Type or paste your content here..."
                />
              </div>

              {/* Image Upload */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <ImageIcon size={14} className="text-slate-400" />
                    <label className="text-xs font-semibold text-slate-500 uppercase">Image (optional)</label>
                  </div>
                  {imageDataUrl && (
                    <button
                      onClick={() => setImageDataUrl('')}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {imageDataUrl ? (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={imageDataUrl}
                      alt="Uploaded content"
                      className="w-full max-h-48 object-cover"
                    />
                  </div>
                ) : (
                  <div
                    ref={dropZoneRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Upload size={24} className={`mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-blue-600">Click to upload</span> or drag & drop
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, GIF, WebP</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {imageError && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {imageError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs text-slate-400">
            Card will be placed on the canvas at the clicked position
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              <span>Add to Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
