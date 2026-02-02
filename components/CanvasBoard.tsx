import React, { useRef, useState, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  MousePointer2, 
  Hand, 
  Grid
} from 'lucide-react';
import { GeneratedContent } from '../types';
import { CanvasCard } from './CanvasCard';

interface CanvasBoardProps {
  items: GeneratedContent[];
  onItemsChange: (items: GeneratedContent[]) => void;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ items, onItemsChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Viewport State
  const [scale, setScale] = useState(0.8); // Start slightly zoomed out
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (isDraggingCard) {
      // Calculate delta in world coordinates
      const zoomAdjustedX = e.movementX / scale;
      const zoomAdjustedY = e.movementY / scale;

      const updatedItems = items.map(item => {
        if (selection.includes(item.id)) {
          return {
            ...item,
            x: item.x + zoomAdjustedX,
            y: item.y + zoomAdjustedY
          };
        }
        return item;
      });
      
      onItemsChange(updatedItems);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingCard(null);
    document.body.style.cursor = 'default';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3);
      
      // Zoom towards pointer logic (simplified for now to center zoom or just scale)
      // For true infinite canvas zoom-to-point, we need more complex matrix math.
      // Keeping it simple: Zoom center for now.
      setScale(newScale);
    } else {
      // Pan with wheel
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

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

  // Render Connections (Simple straight lines for "DNA")
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 flex flex-col">
      {/* Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center space-x-4 z-50">
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
        className="flex-1 w-full h-full relative cursor-default"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
          
          {items.map(item => (
            <CanvasCard 
              key={item.id}
              content={item}
              isSelected={selection.includes(item.id)}
              scale={scale}
              onMouseDown={handleCardMouseDown}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
