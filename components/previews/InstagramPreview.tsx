import React from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Loader2 } from 'lucide-react';

import { PlatformPreviewProps } from './TwitterPreview';

export const InstagramPreview: React.FC<PlatformPreviewProps> = ({ text, imageUrl, brandName }) => {
  const username = brandName.toLowerCase().replace(/\s+/g, '_');
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div>
      {/* Author row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center space-x-2.5">
          {/* Avatar with gradient ring */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-white p-[1px]">
              <div className="w-full h-full rounded-full bg-pink-500 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">{initial}</span>
              </div>
            </div>
          </div>
          <span className="text-[12px] font-semibold text-slate-900">{username}</span>
        </div>
        <button className="text-slate-600">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Image - square 1:1, full width */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Post media"
          className="w-full aspect-square object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full aspect-square bg-slate-50 flex flex-col items-center justify-center">
          <Loader2 size={20} className="animate-spin text-slate-300 mb-1" />
          <span className="text-[10px] text-slate-400">Generating...</span>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center space-x-3">
          <button className="hover:text-slate-500 transition-colors text-slate-800">
            <Heart size={20} />
          </button>
          <button className="hover:text-slate-500 transition-colors text-slate-800">
            <MessageCircle size={20} />
          </button>
          <button className="hover:text-slate-500 transition-colors text-slate-800">
            <Send size={20} />
          </button>
        </div>
        <button className="hover:text-slate-500 transition-colors text-slate-800">
          <Bookmark size={20} />
        </button>
      </div>

      {/* Likes */}
      <div className="px-3 pb-1">
        <span className="text-[12px] font-semibold text-slate-900">1,234 likes</span>
      </div>

      {/* Caption */}
      <div className="px-3 pb-2">
        <p className="text-[12px] text-slate-800 leading-snug line-clamp-2">
          <span className="font-semibold">{username}</span>{' '}
          <span className="whitespace-pre-wrap">{text}</span>
        </p>
        <span className="text-[11px] text-slate-400 cursor-pointer">more</span>
      </div>
    </div>
  );
};
