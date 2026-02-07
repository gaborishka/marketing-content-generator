import React, { useState, useEffect, useMemo } from 'react';
import {
  MoreHorizontal,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Maximize2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Film,
  Play,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { GeneratedContent, getParentChannel } from '../types';
import { TwitterPreview } from './previews/TwitterPreview';
import { LinkedInPreview } from './previews/LinkedInPreview';
import { InstagramPreview } from './previews/InstagramPreview';

interface CanvasCardProps {
  content: GeneratedContent;
  isSelected: boolean;
  scale: number;
  brandName?: string;
  dragOffset?: { x: number; y: number } | null;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const CanvasCardInner: React.FC<CanvasCardProps> = ({
  content,
  isSelected,
  scale,
  brandName = 'Your Brand',
  dragOffset,
  onMouseDown,
  onEdit,
  onDelete,
  onDoubleClick
}) => {
  // Agent step progression for generating state
  const agentSteps = useMemo(() => [
    `Analyzing campaign brief...`,
    `Researching ${content.audience} audience...`,
    `Crafting ${content.channel} copy...`,
    `Optimizing tone & messaging...`,
    `Generating visual assets...`,
    `Running compliance check...`,
    `Finalizing content...`,
  ], [content.audience, content.channel]);

  const [agentStepIndex, setAgentStepIndex] = useState(0);

  useEffect(() => {
    if (content.status !== 'generating') {
      setAgentStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setAgentStepIndex(prev => prev < agentSteps.length - 1 ? prev + 1 : prev);
    }, 2200);
    return () => clearInterval(interval);
  }, [content.status, agentSteps.length]);

  // Render Loading State (Initial Text Generation)
  if (content.status === 'generating') {
    const shimmerStyle: React.CSSProperties = {
      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
    };

    const progressPercent = ((agentStepIndex + 1) / agentSteps.length) * 100;

    return (
      <div
        data-canvas-card
        data-generating="true"
        className="absolute flex flex-col bg-white rounded-xl shadow-lg border border-blue-100/80 z-10 overflow-hidden"
        style={{
          left: content.x,
          top: content.y,
          width: content.width || 320,
          transformOrigin: '0 0',
          cursor: 'wait',
          animation: 'fadeInUp 0.4s ease-out',
        }}
      >
        {/* Progress bar showing actual step progress */}
        <div className="h-1.5 w-full bg-blue-50 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header with channel & audience */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-blue-400" style={{ animation: 'pulseRing 1.5s ease-out infinite' }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{content.channel}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-full">{content.audience}</span>
        </div>

        {/* Skeleton image area */}
        <div className="mx-4 h-28 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden relative">
          <div className="absolute inset-0" style={shimmerStyle} />
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
              <ImageIcon size={20} className="text-slate-300" />
            </div>
          </div>
        </div>

        {/* Agent activity log */}
        <div className="px-4 pt-3 pb-3 space-y-1.5">
          {agentSteps.map((step, i) => {
            if (i > agentStepIndex) return null;
            const isDone = i < agentStepIndex;
            const isCurrent = i === agentStepIndex;
            return (
              <div
                key={i}
                className="flex items-center space-x-2"
                style={isCurrent ? { animation: 'fadeInUp 0.3s ease-out' } : undefined}
              >
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-emerald-600" />
                  </div>
                ) : (
                  <Loader2 size={14} className="animate-spin text-blue-500 flex-shrink-0" />
                )}
                <span className={`text-[11px] leading-tight ${isDone ? 'text-slate-400' : 'text-blue-600 font-medium'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer with step counter */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium">
            Step {agentStepIndex + 1} of {agentSteps.length}
          </span>
          <div className="flex space-x-1">
            {agentSteps.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i <= agentStepIndex ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const parentChannel = getParentChannel(content.channel);
  const isVideoStoryboard = parentChannel === 'Video Storyboard';

  return (
    <div
      data-canvas-card
      className={`absolute flex flex-col bg-white rounded-xl shadow-sm transition-shadow duration-200 select-none group ${
        isSelected ? 'ring-2 ring-blue-500 shadow-xl z-20' : 'hover:shadow-md border border-slate-200 z-10'
      }`}
      style={{
        left: content.x,
        top: content.y,
        width: content.width || 320,
        transformOrigin: '0 0',
        transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
        cursor: 'default',
        willChange: dragOffset ? 'transform' : undefined,
      }}
      onMouseDown={(e) => onMouseDown(e, content.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(content.id);
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl cursor-grab active:cursor-grabbing">
        <div className="flex items-center space-x-2">
          {isVideoStoryboard ? (
            <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold uppercase tracking-wide">
              <Film size={10} />
              <span>Video</span>
            </div>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${
                parentChannel === 'Twitter' ? 'bg-sky-400' :
                parentChannel === 'LinkedIn' ? 'bg-blue-700' :
                parentChannel === 'Instagram' ? 'bg-pink-500' :
                'bg-slate-400'
              }`} />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{content.channel}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {content.videoStatus === 'completed' && <div className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Ready</div>}
          <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Platform-specific preview for Twitter, LinkedIn, Instagram */}
      {(parentChannel === 'Twitter' || parentChannel === 'LinkedIn' || parentChannel === 'Instagram') ? (
        <>
          {parentChannel === 'Twitter' && (
            <TwitterPreview text={content.text} imageUrl={content.imageUrl} brandName={brandName} audience={content.audience} />
          )}
          {parentChannel === 'LinkedIn' && (
            <LinkedInPreview text={content.text} imageUrl={content.imageUrl} brandName={brandName} audience={content.audience} />
          )}
          {parentChannel === 'Instagram' && (
            <InstagramPreview text={content.text} imageUrl={content.imageUrl} brandName={brandName} audience={content.audience} />
          )}

          {/* Compact compliance footer */}
          <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
            <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              content.complianceScore >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              <ShieldCheck size={10} />
              <span>{content.complianceScore}% Safe</span>
            </div>
            <button className="text-slate-400 hover:text-blue-600 transition-colors">
              <Copy size={12} />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Media Preview (generic) */}
          <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-pointer" onClick={() => isVideoStoryboard && onEdit(content.id)}>
            {isVideoStoryboard && content.storyboard ? (
              <div className="grid grid-cols-3 h-full gap-0.5 relative group-hover:opacity-90 transition-opacity">
                {content.storyboard.slice(0, 3).map((scene, i) => (
                  <div key={i} className="relative h-full bg-slate-200 overflow-hidden">
                     {scene.imageUrl ? (
                       <img src={scene.imageUrl} className="w-full h-full object-cover animate-fadeIn" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-slate-200">
                         <Loader2 size={16} className="text-slate-400 animate-spin" />
                       </div>
                     )}
                     <div className="absolute bottom-1 left-1 text-[8px] bg-black/50 text-white px-1 rounded">{i+1}</div>
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-purple-600">
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              content.imageUrl ? (
                <>
                  <img src={content.imageUrl} alt="Asset" className="w-full h-full object-cover animate-fadeIn" draggable={false} />
                  <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 bg-black/60 text-white rounded hover:bg-black/80">
                      <Maximize2 size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                   <ImageIcon size={24} className="mb-2 opacity-50" />
                   <div className="flex items-center space-x-2 text-xs">
                     <Loader2 size={12} className="animate-spin" />
                     <span>Generating Image...</span>
                   </div>
                </div>
              )
            )}
          </div>

          {/* Content Area (generic) */}
          <div className="p-4 space-y-3">
            <div className="flex items-center space-x-2 mb-1">
               <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full border border-slate-200">
                 {content.audience}
               </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-wrap line-clamp-3">
              {isVideoStoryboard ? content.storyboard?.[0]?.voiceover : content.text}
            </p>

            {/* Action / Status Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                 content.complianceScore >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                <ShieldCheck size={12} />
                <span>{content.complianceScore}% Safe</span>
              </div>

              <div className="flex items-center space-x-2">
                {isVideoStoryboard && (
                   <button
                     onClick={() => onEdit(content.id)}
                     className="text-xs font-bold text-purple-600 hover:text-purple-800"
                   >
                     {content.videoStatus === 'completed' ? 'Watch Video' : 'Open Studio'}
                   </button>
                )}
                {!isVideoStoryboard && (
                   <button className="text-slate-400 hover:text-blue-600 transition-colors">
                     <Copy size={14} />
                   </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </div>
  );
};

export const CanvasCard = React.memo(CanvasCardInner);