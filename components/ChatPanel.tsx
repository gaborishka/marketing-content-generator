import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, ImagePlus, X } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, images?: string[]) => void;
  isLoading: boolean;
}

const SUGGESTION_CHIPS = [
  'SaaS product page',
  'Event landing page',
  'Portfolio site',
  'Restaurant homepage',
];

const MAX_IMAGES = 4;
const MAX_DIMENSION = 1024;

function renderMarkdown(text: string): string {
  // Extract code blocks first to protect them from other transformations
  const codeBlocks: string[] = [];
  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:#1e293b;color:#e2e8f0;border-radius:6px;padding:10px 12px;margin:6px 0;overflow-x:auto;font-size:12px;line-height:1.5"><code>${code
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()}</code></pre>`
    );
    return `\x00CB${idx}\x00`;
  });

  // Escape HTML in remaining text
  processed = processed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Inline code
  processed = processed.replace(/`([^`\n]+)`/g,
    '<code style="background:#f1f5f9;color:#334155;padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>');

  // Bold
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (single *, not preceded/followed by *)
  processed = processed.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Process lines for block elements
  const lines = processed.split('\n');
  let html = '';
  let inList: 'ol' | 'ul' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Code block placeholder — emit directly
    const cbMatch = trimmed.match(/^\x00CB(\d+)\x00$/);
    if (cbMatch) {
      if (inList) { html += inList === 'ol' ? '</ol>' : '</ul>'; inList = null; }
      html += codeBlocks[+cbMatch[1]];
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      if (inList) { html += inList === 'ol' ? '</ol>' : '</ul>'; inList = null; }
      html += `<p style="font-weight:600;margin:8px 0 2px">${trimmed.slice(4)}</p>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { html += inList === 'ol' ? '</ol>' : '</ul>'; inList = null; }
      html += `<p style="font-weight:600;margin:8px 0 2px">${trimmed.slice(3)}</p>`;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (inList !== 'ol') {
        if (inList) html += '</ul>';
        html += '<ol style="list-style:decimal;padding-left:20px;margin:4px 0">';
        inList = 'ol';
      }
      html += `<li style="margin:2px 0">${numMatch[2]}</li>`;
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch && !trimmed.match(/^\*[^*]+\*$/)) {
      if (inList !== 'ul') {
        if (inList) html += '</ol>';
        html += '<ul style="list-style:disc;padding-left:20px;margin:4px 0">';
        inList = 'ul';
      }
      html += `<li style="margin:2px 0">${bulletMatch[1]}</li>`;
      continue;
    }

    // Close open list on non-list line
    if (inList) { html += inList === 'ol' ? '</ol>' : '</ul>'; inList = null; }

    // Empty line
    if (trimmed === '') {
      html += '<div style="height:6px"></div>';
      continue;
    }

    // Regular text
    html += `<p style="margin:2px 0">${trimmed}</p>`;
  }

  if (inList) html += inList === 'ol' ? '</ol>' : '</ul>';

  return html;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const dataUrl = e.target!.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const { width, height } = img;
        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          resolve(dataUrl);
          return;
        }
        const scale = MAX_DIMENSION / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || isLoading) return;
    onSendMessage(trimmed || '(image attached)', pendingImages.length > 0 ? pendingImages : undefined);
    setInput('');
    setPendingImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addFiles([file]);
        return;
      }
    }
  };

  const addFiles = async (files: File[]) => {
    const remaining = MAX_IMAGES - pendingImages.length;
    const toProcess = files.slice(0, remaining);
    const resized = await Promise.all(toProcess.map(resizeImage));
    setPendingImages((prev) => [...prev, ...resized]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const hasContent = input.trim() || pendingImages.length > 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <ArrowUp size={20} className="text-blue-500" />
            </div>
            <p className="text-slate-600 font-medium mb-1">Describe your landing page</p>
            <p className="text-sm text-slate-400 mb-4">Tell the AI what kind of page you need and it will ask a few questions before generating.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {msg.images && msg.images.length > 0 && (
                    <div className={`flex gap-1.5 flex-wrap mb-1.5 ${msg.role === 'user' ? '' : ''}`}>
                      {msg.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt=""
                          className="w-20 h-20 rounded object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    // TRUST BOUNDARY: Assistant messages originate from our own Cloud Function.
                    // renderMarkdown escapes HTML before applying formatting. If this feature
                    // matures, consider replacing with a battle-tested library (marked + DOMPurify).
                    <div className="markdown-content [&>p]:leading-relaxed [&>ol]:leading-relaxed [&>ul]:leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex space-x-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-sm transition-all">
          {/* Image previews */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 px-3 pt-3 flex-wrap">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingImages.length >= MAX_IMAGES || isLoading}
              className="p-2 ml-1 mb-1.5 text-slate-400 hover:text-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Attach image"
            >
              <ImagePlus size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Describe your landing page..."
              rows={1}
              style={{ scrollbarWidth: 'none' }}
              className="block flex-1 resize-none bg-transparent pr-11 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none [&::-webkit-scrollbar]:hidden"
            />
            <button
              onClick={handleSend}
              disabled={!hasContent || isLoading}
              className="p-1.5 mr-2 mb-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-1.5">Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
};
