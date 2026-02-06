import React from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { GeneratedContent } from '../types';

interface CanvasCardProps {
  content: GeneratedContent;
  isSelected: boolean;
  scale: number;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CanvasCard: React.FC<CanvasCardProps> = ({ 
  content, 
  isSelected, 
  scale,
  onMouseDown, 
  onEdit, 
  onDelete 
}) => {
  // Render Loading State (Initial Text Generation)
  if (content.status === 'generating') {
    return (
      <div
        className="absolute flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 z-10 overflow-hidden"
        style={{
          left: content.x,
          top: content.y,
          width: content.width || 320,
          transformOrigin: '0 0',
          cursor: 'wait'
        }}
      >
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-blue-500 w-1/2 animate-[progress_1s_ease-in-out_infinite] origin-left" style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
        </div>
        <div className="p-4 space-y-3">
           <div className="flex items-center space-x-2 text-blue-600">
             <Loader2 size={16} className="animate-spin" />
             <span className="text-sm font-medium">Generating Asset...</span>
           </div>
        </div>
      </div>
    );
  }

  const isVideoStoryboard = content.channel === 'Video Storyboard';

  return (
    <div
      className={`absolute flex flex-col bg-white rounded-xl shadow-sm transition-all duration-200 select-none group ${
        isSelected ? 'ring-2 ring-blue-500 shadow-xl z-20 scale-[1.02]' : 'hover:shadow-md border border-slate-200 z-10'
      }`}
      style={{
        left: content.x,
        top: content.y,
        width: content.width || 320,
        transformOrigin: '0 0',
        cursor: 'default'
      }}
      onMouseDown={(e) => onMouseDown(e, content.id)}
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
                content.channel === 'Twitter' ? 'bg-sky-400' :
                content.channel === 'LinkedIn' ? 'bg-blue-700' :
                content.channel === 'Instagram' ? 'bg-pink-500' :
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

      {/* Media Preview */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-pointer" onClick={() => isVideoStoryboard && onEdit(content.id)}>
        {isVideoStoryboard && content.storyboard ? (
          // Storyboard Grid Preview
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
          // Standard Image
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

      {/* Content Area */}
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
      
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </div>
  );
};