import React from 'react';
import { 
  MoreHorizontal, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Maximize2,
  CheckCircle2,
  XCircle,
  MessageSquare
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
  return (
    <div
      className={`absolute flex flex-col bg-white rounded-xl shadow-sm transition-shadow duration-200 select-none group ${
        isSelected ? 'ring-2 ring-blue-500 shadow-xl z-20' : 'hover:shadow-md border border-slate-200 z-10'
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
      {/* Header / Drag Handle */}
      <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl cursor-grab active:cursor-grabbing">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            content.channel === 'Twitter' ? 'bg-sky-400' :
            content.channel === 'LinkedIn' ? 'bg-blue-700' :
            content.channel === 'Instagram' ? 'bg-pink-500' :
            'bg-slate-400'
          }`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{content.channel}</span>
        </div>
        
        <div className="flex items-center space-x-1">
          {content.status === 'approved' && <CheckCircle2 size={14} className="text-emerald-500" />}
          <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Image Area */}
      {content.imageUrl && (
        <div className="relative aspect-video bg-slate-100 overflow-hidden">
          <img src={content.imageUrl} alt="Asset" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1.5 bg-black/60 text-white rounded hover:bg-black/80">
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2 mb-1">
           <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full border border-slate-200">
             {content.audience}
           </span>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
          {content.text}
        </p>

        {/* Compliance & Risk */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium ${
             content.complianceScore >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
             'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            <ShieldCheck size={12} />
            <span>{content.complianceScore}% Safe</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="text-slate-400 hover:text-blue-600 transition-colors" title="Copy Text">
              <Copy size={14} />
            </button>
            <button className="text-slate-400 hover:text-blue-600 transition-colors" title="Comments">
              <MessageSquare size={14} />
            </button>
          </div>
        </div>
        
        {content.riskLevel === 'medium' && (
          <div className="flex items-start space-x-1.5 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>Check medical claims.</span>
          </div>
        )}
      </div>

      {/* Selection Ring (Visual Helper) */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </div>
  );
};
