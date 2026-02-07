import React from 'react';
import { MessageCircle, Repeat2, Heart, Share, Bookmark, Loader2 } from 'lucide-react';
import { RevealImage } from '../RevealImage';

export interface PlatformPreviewProps {
  text: string;
  imageUrl?: string;
  brandName: string;
  audience: string;
}

export const TwitterPreview: React.FC<PlatformPreviewProps> = ({ text, imageUrl, brandName, audience }) => {
  const handle = `@${brandName.toLowerCase().replace(/\s+/g, '')}`;
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div className="px-3 pt-3 pb-2">
      {/* Author row */}
      <div className="flex items-start space-x-2.5 mb-2">
        <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1 text-[12px] leading-tight">
            <span className="font-bold text-slate-900 truncate">{brandName}</span>
            <span className="text-slate-400 truncate">{handle}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">2h</span>
          </div>
          {/* Tweet text */}
          <p className="text-[13px] text-slate-800 leading-snug mt-1 line-clamp-4 whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className="ml-[42px] mb-2">
          <RevealImage
            src={imageUrl}
            alt="Post media"
            className="w-full aspect-video object-cover rounded-xl border border-slate-200"
            draggable={false}
          />
        </div>
      ) : (
        <div className="ml-[42px] mb-2 w-full aspect-video rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
          <Loader2 size={16} className="animate-spin text-slate-300 mb-1" />
          <span className="text-[10px] text-slate-400">Generating...</span>
        </div>
      )}

      {/* Action bar */}
      <div className="ml-[42px] flex items-center justify-between text-slate-400 pr-4">
        <button className="flex items-center space-x-1 hover:text-sky-500 transition-colors">
          <MessageCircle size={13} />
          <span className="text-[11px]">12</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-green-500 transition-colors">
          <Repeat2 size={13} />
          <span className="text-[11px]">48</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-rose-500 transition-colors">
          <Heart size={13} />
          <span className="text-[11px]">215</span>
        </button>
        <button className="hover:text-sky-500 transition-colors">
          <Share size={13} />
        </button>
        <button className="hover:text-sky-500 transition-colors">
          <Bookmark size={13} />
        </button>
      </div>
    </div>
  );
};
