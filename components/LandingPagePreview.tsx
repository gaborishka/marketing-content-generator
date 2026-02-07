import React, { useState, useRef } from 'react';
import { Monitor, Tablet, Smartphone, Copy, Download, Globe, Loader2 } from 'lucide-react';

interface LandingPagePreviewProps {
  html: string | null;
  isGenerating: boolean;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export const LandingPagePreview: React.FC<LandingPagePreviewProps> = ({ html, isGenerating }) => {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = async () => {
    if (!html) return;
    await navigator.clipboard.writeText(html);
  };

  const handleDownload = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing-page.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewportButtons: { key: Viewport; icon: typeof Monitor; label: string }[] = [
    { key: 'desktop', icon: Monitor, label: 'Desktop' },
    { key: 'tablet', icon: Tablet, label: 'Tablet' },
    { key: 'mobile', icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1">
          {viewportButtons.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setViewport(key)}
              title={label}
              className={`p-1.5 rounded transition-colors ${
                viewport === key
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            disabled={!html}
            title="Copy HTML"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Copy size={14} />
            Copy
          </button>
          <button
            onClick={handleDownload}
            disabled={!html}
            title="Download .html"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-start justify-center overflow-auto p-4">
        {html ? (
          <div className="relative bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: VIEWPORT_WIDTHS[viewport], maxWidth: '100%', height: '100%' }}>
            {isGenerating && (
              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            )}
            <iframe
              ref={iframeRef}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
              title="Landing page preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
              <Globe size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Your landing page will appear here</p>
            <p className="text-sm text-slate-400 mt-1">Start a conversation to generate a page</p>
          </div>
        )}
      </div>
    </div>
  );
};
