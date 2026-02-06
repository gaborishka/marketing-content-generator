import React from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, Loader2 } from 'lucide-react';

import { PlatformPreviewProps } from './TwitterPreview';

export const LinkedInPreview: React.FC<PlatformPreviewProps> = ({ text, imageUrl, brandName, audience }) => {
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div className="pt-3">
      {/* Author row */}
      <div className="flex items-start space-x-2.5 px-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900 leading-tight">{brandName}</div>
          <div className="text-[11px] text-slate-500 leading-tight">Marketing to {audience}</div>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 leading-tight">
            <span>1d</span>
            <span>·</span>
            <Globe size={10} />
          </div>
        </div>
      </div>

      {/* Post text */}
      <div className="px-3 mb-2">
        <p className="text-[13px] text-slate-800 leading-snug line-clamp-3 whitespace-pre-wrap">
          {text}
        </p>
        <span className="text-[12px] text-blue-600 cursor-pointer hover:underline">...see more</span>
      </div>

      {/* Image - full width, no horizontal padding */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Post media"
          className="w-full aspect-[4/3] object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full aspect-[4/3] bg-slate-50 flex flex-col items-center justify-center">
          <Loader2 size={18} className="animate-spin text-slate-300 mb-1" />
          <span className="text-[10px] text-slate-400">Generating...</span>
        </div>
      )}

      {/* Reactions row */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-1">
          <span className="inline-flex">
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px]">&#128077;</span>
            <span className="w-4 h-4 rounded-full bg-yellow-400 -ml-1 flex items-center justify-center text-[8px]">&#128522;</span>
            <span className="w-4 h-4 rounded-full bg-green-500 -ml-1 flex items-center justify-center text-[8px]">&#127881;</span>
          </span>
          <span>42</span>
        </div>
        <span>8 comments</span>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-200" />

      {/* Action bar */}
      <div className="px-2 py-1 flex items-center justify-between">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageSquare, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center space-x-1 px-2 py-1.5 rounded hover:bg-slate-100 transition-colors text-slate-500"
          >
            <Icon size={14} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
