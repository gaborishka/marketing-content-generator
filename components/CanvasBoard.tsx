import React, { useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  MousePointer2,
  Hand,
  Grid,
  Plus
} from 'lucide-react';
import { GeneratedContent } from '../types';
import { CanvasCard } from './CanvasCard';

interface CanvasBoardProps {
  items: GeneratedContent[];
  onItemsChange: (items: GeneratedContent[]) => void;
  onEdit?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onCanvasDoubleClick?: (canvasPos: { x: number; y: number }) => void;
  onPasteOnCanvas?: (canvasPos: { x: number; y: number }, text?: string, imageDataUrl?: string) => void;
  pasteEnabled?: boolean;
  brandName?: string;
  focusTarget?: { x: number; y: number; timestamp: number } | null;
}

const noopDelete = () => {};

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ items, onItemsChange, onEdit, onDoubleClick, onCanvasDoubleClick, onPasteOnCanvas, pasteEnabled = true, brandName, focusTarget }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport State
  const [scale, setScale] = useState(0.8); // Start slightly zoomed out
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Refs for paste handler to avoid re-registering on every pan/zoom
  const offsetRef = useRef(offset);
  const scaleRef = useRef(scale);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  
  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');

  // Ref-based drag tracking — accumulates movement without triggering re-renders
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Auto-pan to focus target when it changes
  useEffect(() => {
    if (!focusTarget || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetOffset = {
      x: rect.width / 2 - focusTarget.x * scale,
      y: rect.height / 2 - focusTarget.y * scale,
    };
    setOffset(targetOffset);
  }, [focusTarget]);

  // Convert screen coordinates to canvas world coordinates (uses refs for stable access)
  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offsetRef.current.x) / scaleRef.current,
      y: (clientY - rect.top - offsetRef.current.y) / scaleRef.current,
    };
  };

  // Mouse Event Handlers for the Canvas (Background)
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on background
    if (e.button === 0) { // Left click
      if (interactionMode === 'pan' || e.altKey || e.metaKey) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        document.body.style.cursor = 'grabbing';
      } else {
        // Deselect if clicking empty space without shift
        if (!e.shiftKey) {
          setSelection([]);
        }
      }
    }
  };

  // Double-click on empty canvas space → open content creation modal
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    // Only trigger if clicking on the canvas background (not a card or other child)
    const target = e.target as HTMLElement;
    if (onCanvasDoubleClick && target.dataset.canvasBg !== undefined) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      onCanvasDoubleClick(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (isDraggingCard) {
      // Accumulate delta in world coordinates via ref (no state update per frame)
      const dx = e.movementX / scale;
      const dy = e.movementY / scale;
      dragOffsetRef.current.x += dx;
      dragOffsetRef.current.y += dy;
      // Single state update per frame — only dragged cards consume this via CSS transform
      setDragOffset({ x: dragOffsetRef.current.x, y: dragOffsetRef.current.y });
    }
  };

  const handleMouseUp = () => {
    // Commit final drag positions once on mouseup
    if (isDraggingCard && (dragOffsetRef.current.x !== 0 || dragOffsetRef.current.y !== 0)) {
      const dx = dragOffsetRef.current.x;
      const dy = dragOffsetRef.current.y;
      const updatedItems = items.map(item => {
        if (selection.includes(item.id)) {
          return { ...item, x: item.x + dx, y: item.y + dy };
        }
        return item;
      });
      onItemsChange(updatedItems);
    }

    // Reset drag state
    dragOffsetRef.current = { x: 0, y: 0 };
    setDragOffset(null);
    setIsPanning(false);
    setIsDraggingCard(null);
    document.body.style.cursor = 'default';
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        setScale(prev => Math.min(Math.max(0.1, prev - e.deltaY * zoomSensitivity), 3));
      } else {
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Paste event handler — opens creation modal with pasted text or image
  // Uses refs for offset/scale to avoid re-registering on every pan/zoom
  const onPasteRef = useRef(onPasteOnCanvas);
  useEffect(() => { onPasteRef.current = onPasteOnCanvas; }, [onPasteOnCanvas]);

  const pasteEnabledRef = useRef(pasteEnabled);
  useEffect(() => { pasteEnabledRef.current = pasteEnabled; }, [pasteEnabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (!onPasteRef.current || !pasteEnabledRef.current) return;

      // Don't intercept paste when user is typing in an input/textarea/contentEditable
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || (active as HTMLElement).isContentEditable)) {
        return;
      }

      const getCanvasCenter = () => {
        const rect = el.getBoundingClientRect();
        return screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
      };

      // Check for image in clipboard
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                onPasteRef.current?.(getCanvasCenter(), undefined, reader.result as string);
              };
              reader.readAsDataURL(blob);
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Check for text
      const pastedText = e.clipboardData?.getData('text/plain');
      if (pastedText && pastedText.trim()) {
        onPasteRef.current(getCanvasCenter(), pastedText.trim(), undefined);
        e.preventDefault();
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []); // Registered once; screenToCanvas reads from refs

  // Card Handlers
  const handleCardMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent canvas pan start
    
    // Handle Selection
    if (e.shiftKey) {
      setSelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      if (!selection.includes(id)) {
        setSelection([id]);
      }
    }

    // Start Dragging
    setIsDraggingCard(id);
  };

  // Render Connections
  const renderConnections = () => {
    return (
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
        {items.map(item => {
           if (item.connections) {
             return item.connections.map(targetId => {
               const target = items.find(i => i.id === targetId);
               if (target) {
                 const startX = item.x + (item.width || 320) / 2;
                 const startY = item.y + (item.height || 200) / 2;
                 const endX = target.x + (target.width || 320) / 2;
                 const endY = target.y + (target.height || 200) / 2;
                 return (
                   <line 
                    key={`${item.id}-${targetId}`}
                    x1={startX} y1={startY} x2={endX} y2={endY} 
                    stroke="#cbd5e1" 
                    strokeWidth="2" 
                    strokeDasharray="5,5"
                   />
                 );
               }
               return null;
             });
           }
           return null;
        })}
      </svg>
    );
  };

  // Safe wrapper for onEdit
  const handleEdit = (id: string) => {
    if (onEdit) {
      onEdit(id);
    } else {
      // Try to find the event from parent if passed via other means, or log warning
      console.warn("Edit handler not connected");
    }
  };

  // We need to inject the onEdit handler from props to the CampaignDetail usage
  // The CampaignDetail component in the previous update didn't pass onEdit, I need to update it in CampaignDetail.tsx too.
  // Wait, I updated CampaignDetail.tsx in the previous block but I commented about it. 
  // I need to ensure CampaignDetail.tsx passes the prop.
  
  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 flex flex-col">
      {/* Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center space-x-4 z-50">
        {onCanvasDoubleClick && (
          <div className="flex items-center border-r border-slate-200 pr-4">
            <button
              onClick={() => {
                const el = containerRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const pos = screenToCanvas(
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2
                );
                onCanvasDoubleClick(pos);
              }}
              className="p-2 rounded-lg transition-colors text-slate-500 hover:bg-slate-100"
              title="Add Content"
            >
              <Plus size={18} />
            </button>
          </div>
        )}
        <div className="flex items-center space-x-1 border-r border-slate-200 pr-4">
           <button
             onClick={() => setInteractionMode('select')}
             className={`p-2 rounded-lg transition-colors ${interactionMode === 'select' ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
             title="Select Mode (V)"
           >
             <MousePointer2 size={18} />
           </button>
           <button
             onClick={() => setInteractionMode('pan')}
             className={`p-2 rounded-lg transition-colors ${interactionMode === 'pan' ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
             title="Pan Mode (H)"
           >
             <Hand size={18} />
           </button>
        </div>
        
        <div className="flex items-center space-x-2">
           <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
             <ZoomOut size={18} />
           </button>
           <span className="text-xs font-mono w-12 text-center text-slate-600">{Math.round(scale * 100)}%</span>
           <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
             <ZoomIn size={18} />
           </button>
           <button onClick={() => { setScale(1); setOffset({x:0, y:0}); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg ml-2" title="Reset View">
             <Maximize size={16} />
           </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        data-canvas-bg
        className="flex-1 w-full h-full relative cursor-default"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: `${20 * scale}px ${20 * scale}px`, // Dynamic grid based on scale
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          backgroundColor: '#f1f5f9'
        }}
      >
        <div 
          className="absolute origin-top-left will-change-transform"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {renderConnections()}
          
          {items.map(item => {
            const isSelected = selection.includes(item.id);
            return (
              <CanvasCard
                key={item.id}
                content={item}
                isSelected={isSelected}
                scale={scale}
                brandName={brandName}
                dragOffset={isSelected ? dragOffset : null}
                onMouseDown={handleCardMouseDown}
                onEdit={handleEdit}
                onDelete={noopDelete}
                onDoubleClick={onDoubleClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};