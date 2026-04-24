import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Pin, Highlighter, UserIcon, Edit2, Maximize2, Minimize2,
  GripHorizontal, Hand, ChevronRight, MessageSquare, Check, ChevronDown
} from '../lib/icons/lucide';
import { type Annotation, type MemberRole } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { createPortal } from 'react-dom';
import {
  useOptionalAnnotationContext,
  PRESET_COLORS as CTX_PRESET_COLORS,
  DEFAULT_TOOL_CONFIG,
} from './AnnotationContext';

const getSmoothedPath = (points: {x: number, y: number}[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    d += ` Q ${p1.x} ${p1.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

const getDynamicCursor = (mode: string) => {
  let svg = '';
  let hotspot = '0 24';
  if (mode === 'draw') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    hotspot = '0 28';
  } else if (mode === 'pin') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
    hotspot = '14 28';
  } else if (mode === 'highlight') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`;
    hotspot = '0 28';
  } else {
    return 'crosshair';
  }
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") ${hotspot}, crosshair`;
};

interface AnnotationSystemProps {
  annotations: Annotation[];
  onSave: (next: Annotation[]) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentTime?: number;
  mediaType?: 'image' | 'video' | 'pdf' | 'document';
  isReadOnly?: boolean;
  userRole?: MemberRole;
  onModeChange?: (mode: 'inspect' | 'pin' | 'highlight' | 'draw') => void;
  onSeek?: (time: number) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export const AnnotationSystem: React.FC<AnnotationSystemProps> = ({
  annotations,
  onSave,
  containerRef,
  currentTime = 0,
  mediaType = 'document',
  isReadOnly = false,
  userRole,
  onModeChange,
  onSeek,
  currentPage,
  onPageChange
}) => {
  const { user } = useAuth();
  const ctx = useOptionalAnnotationContext();

  // ── Internal state (used only in legacy single-page mode, i.e. when ctx === null) ─
  const [_activeMode,            _setActiveMode]            = useState<'inspect' | 'pin' | 'highlight' | 'draw'>('inspect');
  const [_activeAnnotationId,    _setActiveAnnotationId]    = useState<string | null>(null);
  const [_editingId,             _setEditingId]             = useState<string | null>(null);
  const [_isMinimized,           _setIsMinimized]           = useState(true);
  const [_relocatingAnnotation,  _setRelocatingAnnotation]  = useState<{ id: string, x: number, y: number, originalX: number, originalY: number } | null>(null);
  const [_replyText,             _setReplyText]             = useState<Record<string, string>>({});
  const [_editingText,           _setEditingText]           = useState('');
  const [_activeColor,           _setActiveColor]           = useState(CTX_PRESET_COLORS[0]);
  const [_toolConfig,            _setToolConfig]            = useState(DEFAULT_TOOL_CONFIG);
  const [_openConfig,            _setOpenConfig]            = useState<'pin' | 'highlight' | 'draw' | null>(null);

  // ── Resolved state — context takes priority ─────────────────────────────
  const activeMode            = ctx ? ctx.activeMode            : _activeMode;
  const setActiveMode         = ctx ? ctx.setActiveMode         : _setActiveMode;
  const activeAnnotationId    = ctx ? ctx.activeAnnotationId    : _activeAnnotationId;
  const setActiveAnnotationId = ctx ? ctx.setActiveAnnotationId : _setActiveAnnotationId;
  const editingId             = ctx ? ctx.editingId             : _editingId;
  const setEditingId          = ctx ? ctx.setEditingId          : _setEditingId;
  const isMinimized           = ctx ? ctx.isMinimized           : _isMinimized;
  const setIsMinimized        = ctx ? ctx.setIsMinimized        : _setIsMinimized;
  const relocatingAnnotation  = ctx ? ctx.relocatingAnnotation  : _relocatingAnnotation;
  const setRelocatingAnnotation = ctx ? ctx.setRelocatingAnnotation : _setRelocatingAnnotation;
  const replyText             = ctx ? ctx.replyText             : _replyText;
  const setReplyText          = ctx ? ctx.setReplyText          : _setReplyText;
  const editingText           = ctx ? ctx.editingText           : _editingText;
  const setEditingText        = ctx ? ctx.setEditingText        : _setEditingText;
  const activeColor           = ctx ? ctx.activeColor           : _activeColor;
  const setActiveColor        = ctx ? ctx.setActiveColor        : _setActiveColor;
  const toolConfig            = ctx ? ctx.toolConfig            : _toolConfig;
  const setToolConfig         = ctx ? ctx.setToolConfig         : _setToolConfig;
  const openConfig            = ctx ? ctx.openConfig            : _openConfig;
  const setOpenConfig         = ctx ? ctx.setOpenConfig         : _setOpenConfig;

  const PRESET_COLORS = CTX_PRESET_COLORS;

  // ── Legacy-only state (draw overlay, not needed in context/multi-page mode) ─
  const [mousePos,     setMousePos]     = useState<{ x: number; y: number } | null>(null);
  const [isDrawing,    setIsDrawing]    = useState(false);
  const [currentPath,  setCurrentPath]  = useState<{ x: number; y: number }[]>([]);

  // ── Dropdown edge-awareness ──────────────────────────────────────────────
  const pinDropRef  = useRef<HTMLDivElement>(null);
  const hlDropRef   = useRef<HTMLDivElement>(null);
  const drawDropRef = useRef<HTMLDivElement>(null);
  const [pinDropSide,  setPinDropSide]  = useState<'left' | 'right'>('left');
  const [hlDropSide,   setHlDropSide]   = useState<'left' | 'right'>('left');
  const [drawDropSide, setDrawDropSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    const DROPDOWN_W = 176; // w-44
    const measure = (ref: React.RefObject<HTMLDivElement | null>, set: (s: 'left' | 'right') => void) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      set(r.left + DROPDOWN_W > window.innerWidth - 8 ? 'right' : 'left');
    };
    if (openConfig === 'pin')       measure(pinDropRef,  setPinDropSide);
    if (openConfig === 'highlight') measure(hlDropRef,   setHlDropSide);
    if (openConfig === 'draw')      measure(drawDropRef, setDrawDropSide);
  }, [openConfig]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistAnnotations = useCallback((next: Annotation[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave(next);
    }, 800);
  }, [onSave]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  useEffect(() => {
    if (onModeChange) onModeChange(activeMode);
  }, [activeMode, onModeChange]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (isReadOnly || activeMode === 'inspect' || activeMode === 'draw') return;
    placePinAt(e.clientX, e.clientY);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    // Auto-enter pin mode if not already and place pin
    if (activeMode === 'inspect') setActiveMode('pin');
    if (activeMode !== 'draw') {
      placePinAt(e.clientX, e.clientY);
    }
  };

  const placePinAt = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    const newId = Math.random().toString(36).substr(2, 9);
    const newAnnotation: Annotation = {
      id: newId,
      x,
      y,
      text: "",
      userName: user?.displayName || user?.email || "Anonymous",
      userPhoto: user?.photoURL || undefined,
      createdAt: new Date().toISOString(),
      type: 'pin',
      color: activeColor,
      pinSize: toolConfig.pin.size,
      replies: [],
      timestamp: mediaType === 'video' ? currentTime : undefined,
      pageNumber: currentPage
    };

    const next = [...annotations, newAnnotation];
    onSave(next);
    setActiveMode('inspect');
    setIsMinimized(false);
    setEditingId(newId);
    setActiveAnnotationId(newId);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const confirmRelocation = () => {
    if (!relocatingAnnotation) return;
    const next = annotations.map(a =>
      a.id === relocatingAnnotation!.id
        ? { ...a, x: relocatingAnnotation!.x, y: relocatingAnnotation!.y }
        : a
    );
    onSave(next);
    setRelocatingAnnotation(null);
  };

  const cancelRelocation = () => setRelocatingAnnotation(null);

  const updateAnnotationText = (id: string, text: string) => {
    const next = annotations.map(a => a.id === id ? { ...a, text } : a);
    persistAnnotations(next);
  };

  const removeAnnotation = (id: string) => {
    const next = annotations.filter(a => a.id !== id);
    persistAnnotations(next);
    if (activeAnnotationId === id) setActiveAnnotationId(null);
  };

  const selectAnnotation = (id: string) => {
    setActiveAnnotationId(id);
    setIsMinimized(false);
    
    const anno = annotations.find(a => a.id === id);
    if (anno?.timestamp !== undefined && onSeek) {
      onSeek(anno.timestamp);
    }
    
    // If it's on a different page, we might need external help to switch pages.
    if (anno?.pageNumber && anno.pageNumber !== currentPage && onPageChange) {
      onPageChange(anno.pageNumber);
    }
    
    // For now, we'll just focus the card.
    const card = document.getElementById(`comment-card-${id}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text || "");
  };

  const handleSave = (id: string) => {
    updateAnnotationText(id, editingText);
    setEditingId(null);
  };

  return (
    <>
      {/* Overlay (draw/pin/highlight canvas) — skipped in multi-page/context mode */}
      {!ctx && <div
        onDoubleClick={handleDoubleClick}
        className={cn(
          "absolute inset-0 w-full h-full z-[100] pointer-events-none",
          isReadOnly && "pointer-events-none"
        )}
      >
      {/* Click-to-Add & Drawing Overlay */}
      {!isReadOnly && activeMode !== 'inspect' && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            if (activeMode === 'draw' || activeMode === 'highlight') {
              setIsDrawing(true);
              const rect = containerRef.current?.getBoundingClientRect();
              if (rect) {
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setCurrentPath([{ x, y }]);
              }
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setMousePos({ x, y });
              if (isDrawing && (activeMode === 'draw' || activeMode === 'highlight')) {
                setCurrentPath(prev => [...prev, { x, y }]);
              }
            }
          }}
          onPointerUp={(e) => {
            if (isDrawing && (activeMode === 'draw' || activeMode === 'highlight')) {
              setIsDrawing(false);
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              if (currentPath.length > 2) {
                const newId = Math.random().toString(36).substr(2, 9);
                const newAnnotation: Annotation = {
                  id: newId,
                  x: currentPath[0].x,
                  y: currentPath[0].y,
                  text: "",
                  userName: user?.displayName || user?.email || "Anonymous",
                  userPhoto: user?.photoURL || undefined,
                  createdAt: new Date().toISOString(),
                  type: activeMode === 'highlight' ? 'highlight' : 'draw',
                  path: currentPath,
                  color: activeColor,
                  strokeWidth: activeMode === 'highlight'
                    ? toolConfig.highlight.thickness
                    : toolConfig.draw.thickness,
                  replies: [],
                  pageNumber: currentPage
                };
                onSave([...annotations, newAnnotation]);
                setActiveMode('inspect');
                setIsMinimized(false);
                setEditingId(newId);
                setActiveAnnotationId(newId);
              }
              setCurrentPath([]);
            }
          }}
          onClick={(e) => {
            if (activeMode === 'pin') handleContainerClick(e);
          }}
          onMouseLeave={() => setMousePos(null)}
          className="absolute inset-0 z-[90] pointer-events-auto bg-primary/5 border-2 border-transparent transition-colors"
          style={{ cursor: getDynamicCursor(activeMode) }}
        />
      )}

      {/* Ghost Mouse Activity Layer */}
      {mousePos && activeMode !== 'draw' && activeMode !== 'inspect' && !isDrawing && (
        <div
          className="absolute pointer-events-none z-[91]"
          style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          {activeMode === 'pin' ? (
            <div className="w-12 h-12 rounded-full border-2 border-white bg-white/10 animate-pulse" />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-white bg-white/20 animate-pulse mix-blend-overlay" />
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 text-white text-[8px] font-black uppercase tracking-widest rounded whitespace-nowrap">
            Click to Place {activeMode}
          </div>
        </div>
      )}

      {/* Drawings & Highlights SVG Layer */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
      >
        {/* Highlights - transparent filled strokes (like a marker pen) */}
        {annotations.filter(a => a.type === 'highlight' && a.path && (!currentPage || (a.pageNumber || 1) === currentPage)).map(anno => {
           const isActive = activeAnnotationId === anno.id;
           const pathData = getSmoothedPath(anno.path!);
           const sw = anno.strokeWidth ?? toolConfig.highlight.thickness;
           return (
             <g key={anno.id} onClick={() => selectAnnotation(anno.id)} className="pointer-events-auto cursor-pointer">
               <path d={pathData} fill="none" stroke="transparent" strokeWidth={sw + 10} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
               <path
                  d={pathData}
                  fill="none"
                  stroke={anno.color || "hsl(var(--primary))"}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ opacity: isActive ? 0.45 : 0.28, mixBlendMode: 'multiply' }}
                  className="transition-opacity"
               />
             </g>
           );
        })}

        {/* Freehand Drawings - dashed outlined strokes */}
        {annotations.filter(a => a.type === 'draw' && a.path && (!currentPage || (a.pageNumber || 1) === currentPage)).map(anno => {
           const isActive = activeAnnotationId === anno.id;
           const pathData = getSmoothedPath(anno.path!);
           const sw = anno.strokeWidth ?? toolConfig.draw.thickness;
           return (
             <g key={anno.id} onClick={() => selectAnnotation(anno.id)} className="pointer-events-auto cursor-pointer">
               <path d={pathData} fill="none" stroke="transparent" strokeWidth={sw + 12} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
               <path
                  d={pathData}
                  fill="none"
                  stroke={anno.color || "currentColor"}
                  strokeWidth={isActive ? sw + 1 : sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2 6"
                  vectorEffect="non-scaling-stroke"
                  className={cn("transition-all text-primary", isActive ? "opacity-100 drop-shadow-md" : "opacity-50 hover:opacity-80")}
               />
             </g>
           );
        })}

        {/* Live drawing preview */}
        {isDrawing && currentPath.length > 0 && (
           <path
              d={getSmoothedPath(currentPath)}
              fill="none"
              stroke={activeColor}
              strokeWidth={activeMode === 'highlight' ? toolConfig.highlight.thickness : toolConfig.draw.thickness}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={activeMode === 'highlight' ? undefined : '2 6'}
              vectorEffect="non-scaling-stroke"
              style={{
                opacity: activeMode === 'highlight' ? 0.3 : 1,
                mixBlendMode: activeMode === 'highlight' ? 'multiply' : 'normal'
              }}
           />
        )}
      </svg>

      {/* The Visual Pins/Highlights */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
        {annotations.map((anno, index) => {
            if (anno.type === 'draw') return null;
            if (currentPage && (anno.pageNumber || 1) !== currentPage) return null;
            const isRelocating = relocatingAnnotation?.id === anno.id;
            const isActive = activeAnnotationId === anno.id;
            
            if (mediaType === 'video' && anno.timestamp !== undefined) {
              const diff = Math.abs(currentTime - anno.timestamp);
              if (diff > 2.5) return null;
            }

            return (
              <motion.div
                key={anno.id}
                initial={{ scale: 0, opacity: 0, x: "-50%", y: "-50%" }}
                animate={{ 
                  scale: isActive ? 1.2 : 1, 
                  opacity: 1,
                  x: "-50%",
                  y: "-50%",
                  left: isRelocating ? `${relocatingAnnotation.x}%` : `${anno.x}%`,
                  top: isRelocating ? `${relocatingAnnotation.y}%` : `${anno.y}%`,
                  zIndex: isActive ? 100 : 40
                }}
                drag={!isReadOnly && activeMode === 'inspect'}
                dragMomentum={false}
                dragElastic={0}
                onPointerDown={(e) => {
                   e.stopPropagation();
                   (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                   selectAnnotation(anno.id);
                }}
                onPointerUp={(e) => {
                   (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                }}
                onDragEnd={(_, info) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const newX = ((info.point.x - rect.left) / rect.width) * 100;
                  const newY = ((info.point.y - rect.top) / rect.height) * 100;
                  
                  setRelocatingAnnotation({
                      id: anno.id, x: newX, y: newY, originalX: anno.x, originalY: anno.y
                  });
                }}
                className={cn("absolute group pointer-events-auto", !isReadOnly && "cursor-grab active:cursor-grabbing")}
                style={{ touchAction: 'none' }}
              >
                  {anno.type === 'pin' ? (
                    <div className="relative">
                       {isRelocating && (
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 flex flex-col items-center gap-2 z-[100]">
                            <div className="bg-primary/95 text-primary-foreground text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl border border-white/20 backdrop-blur-md">Confirm Move?</div>
                            <div className="flex items-center gap-1.5 p-1 bg-card/95 backdrop-blur-md rounded-full shadow-xl border border-border/50">
                               <button onClick={confirmRelocation} className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-[8px] font-black uppercase">Yes</button>
                               <button onClick={cancelRelocation} className="px-3 py-1 hover:bg-muted text-foreground rounded-full text-[8px] font-black uppercase">No</button>
                            </div>
                         </div>
                       )}
                       {(() => {
                         const ps = anno.pinSize ?? toolConfig.pin.size;
                         const fontSize = Math.max(8, Math.round(ps * 0.23));
                         return (
                           <div
                             className={cn("rounded-full border-2 transition-all duration-300 flex items-center justify-center", isActive ? "shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "shadow-sm")}
                             style={{
                               width: ps, height: ps,
                               borderColor: anno.color || "rgba(255,255,255,0.4)",
                               backgroundColor: anno.color ? `${anno.color}33` : "rgba(255,255,255,0.05)",
                               mixBlendMode: anno.color ? "normal" : "exclusion"
                             }}
                           >
                             <span style={{ fontSize, color: anno.color || "white" }} className="font-black">{index + 1}</span>
                           </div>
                         );
                       })()}
                    </div>
                  ) : null}
              </motion.div>
            );
        })}
      </div>
      </div>
      }
      {/* end overlay */}

      {/* Right Sidebar Interface */}
      {createPortal(
        <AnimatePresence>
          {!isMinimized && (
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-14 right-0 bottom-0 w-80 max-w-[85vw] bg-card border-l border-border shadow-2xl flex flex-col z-[99999] pointer-events-auto"
          >
            {/* Header */}
            <div className="flex flex-col border-b border-border p-4 gap-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black tracking-widest text-foreground uppercase">Document Feedback</span>
                  {userRole && (
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-widest",
                      userRole === 'owner' ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {userRole} view
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-all active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tool Selection */}
              <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl">
                {/* Inspect — no config */}
                <button
                  onClick={() => { setActiveMode('inspect'); setOpenConfig(null); }}
                  className={cn("flex-1 p-2 flex items-center justify-center rounded-lg transition-all text-muted-foreground hover:bg-background/50", activeMode === 'inspect' && "bg-background text-foreground shadow-sm")}
                  title="Inspect"
                >
                  <Hand size={14}/>
                </button>

                {/* Pin + chevron */}
                <div ref={pinDropRef} className="relative flex-1 flex">
                  <button
                    onClick={() => { setActiveMode('pin'); setOpenConfig(null); }}
                    className={cn("flex-1 p-2 flex items-center justify-center rounded-l-lg transition-all text-muted-foreground hover:bg-background/50", activeMode === 'pin' && "bg-background text-foreground shadow-sm")}
                    title="Pin"
                  >
                    <Pin size={14}/>
                  </button>
                  <button
                    onClick={() => setOpenConfig(openConfig === 'pin' ? null : 'pin')}
                    className={cn("px-0.5 flex items-center rounded-r-lg transition-all text-muted-foreground hover:bg-background/50", openConfig === 'pin' && "bg-background text-foreground shadow-sm")}
                  >
                    <ChevronDown size={10}/>
                  </button>
                  {openConfig === 'pin' && (
                    <div className={`absolute top-full ${pinDropSide}-0 mt-1 z-[200] bg-card border border-border rounded-xl shadow-xl p-3 w-44 flex flex-col gap-2`}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pin Size</span>
                      <input
                        type="range" min={24} max={80} step={4}
                        value={toolConfig.pin.size}
                        onChange={e => setToolConfig(c => ({ ...c, pin: { ...c.pin, size: Number(e.target.value) } }))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>S</span><span className="font-black text-foreground">{toolConfig.pin.size}px</span><span>L</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Highlight + chevron */}
                <div ref={hlDropRef} className="relative flex-1 flex">
                  <button
                    onClick={() => { setActiveMode('highlight'); setOpenConfig(null); }}
                    className={cn("flex-1 p-2 flex items-center justify-center rounded-l-lg transition-all text-muted-foreground hover:bg-background/50", activeMode === 'highlight' && "bg-background text-foreground shadow-sm")}
                    title="Highlight"
                  >
                    <Highlighter size={14}/>
                  </button>
                  <button
                    onClick={() => setOpenConfig(openConfig === 'highlight' ? null : 'highlight')}
                    className={cn("px-0.5 flex items-center rounded-r-lg transition-all text-muted-foreground hover:bg-background/50", openConfig === 'highlight' && "bg-background text-foreground shadow-sm")}
                  >
                    <ChevronDown size={10}/>
                  </button>
                  {openConfig === 'highlight' && (
                    <div className={`absolute top-full ${hlDropSide}-0 mt-1 z-[200] bg-card border border-border rounded-xl shadow-xl p-3 w-44 flex flex-col gap-2`}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Thickness</span>
                      <input
                        type="range" min={4} max={32} step={2}
                        value={toolConfig.highlight.thickness}
                        onChange={e => setToolConfig(c => ({ ...c, highlight: { ...c.highlight, thickness: Number(e.target.value) } }))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Thin</span><span className="font-black text-foreground">{toolConfig.highlight.thickness}px</span><span>Thick</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Draw + chevron */}
                <div ref={drawDropRef} className="relative flex-1 flex">
                  <button
                    onClick={() => { setActiveMode('draw'); setOpenConfig(null); }}
                    className={cn("flex-1 p-2 flex items-center justify-center rounded-l-lg transition-all text-muted-foreground hover:bg-background/50", activeMode === 'draw' && "bg-background text-foreground shadow-sm")}
                    title="Draw"
                  >
                    <Edit2 size={14}/>
                  </button>
                  <button
                    onClick={() => setOpenConfig(openConfig === 'draw' ? null : 'draw')}
                    className={cn("px-0.5 flex items-center rounded-r-lg transition-all text-muted-foreground hover:bg-background/50", openConfig === 'draw' && "bg-background text-foreground shadow-sm")}
                  >
                    <ChevronDown size={10}/>
                  </button>
                  {openConfig === 'draw' && (
                    <div className={`absolute top-full ${drawDropSide}-0 mt-1 z-[200] bg-card border border-border rounded-xl shadow-xl p-3 w-44 flex flex-col gap-2`}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Stroke Width</span>
                      <input
                        type="range" min={1} max={10} step={0.5}
                        value={toolConfig.draw.thickness}
                        onChange={e => setToolConfig(c => ({ ...c, draw: { ...c.draw, thickness: Number(e.target.value) } }))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Fine</span><span className="font-black text-foreground">{toolConfig.draw.thickness}px</span><span>Bold</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Default Tool Color Selection */}
              {activeMode !== 'inspect' && !isReadOnly && (
                <div className="flex justify-between items-center px-3 pt-1 border-t border-border/50">
                  {PRESET_COLORS.map(c => (
                     <button
                       key={c}
                       onClick={() => setActiveColor(c)}
                       title="Select tool color"
                       className={cn(
                         "w-4 h-4 rounded-full border transition-all hover:scale-125",
                         activeColor === c ? "scale-125 shadow-md ring-2 ring-primary/20 border-foreground/30" : "border-border shadow-sm border-transparent hover:border-border"
                       )}
                       style={{ backgroundColor: c }}
                     />
                  ))}
                </div>
              )}
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {annotations.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30"><MessageSquare size={20} /></div>
                  <p className="text-muted-foreground/50 text-[10px] font-black uppercase tracking-widest">No feedback yet.</p>
                </div>
              ) : (
                annotations.map((anno, idx) => (
                  <div 
                    key={anno.id} 
                    id={`comment-card-${anno.id}`}
                    onClick={() => selectAnnotation(anno.id)}
                    className={cn(
                      "group flex flex-col gap-3 p-4 border rounded-2xl transition-all cursor-pointer relative",
                      activeAnnotationId === anno.id ? "bg-card border-primary/50 shadow-lg ring-1 ring-primary/20" : "bg-muted/10 border-transparent hover:border-border"
                    )}
                  >
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border shrink-0">
                              {anno.userPhoto ? <img src={anno.userPhoto} className="w-full h-full object-cover"/> : <UserIcon size={14} className="text-muted-foreground/40"/>}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-foreground truncate uppercase tracking-widest">{anno.userName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-bold tracking-widest text-muted-foreground uppercase">{anno.type}</span>
                              <span className="text-[8px] font-mono text-muted-foreground/40">{new Date(anno.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {anno.timestamp !== undefined && (
                                <span className="text-[8px] font-black text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                                  {formatTime(anno.timestamp)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                           <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-black", activeAnnotationId === anno.id ? "bg-primary text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground")}>{idx + 1}</div>
                           {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); removeAnnotation(anno.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"><X size={12}/></button>}
                        </div>
                      </div>

                      {/* Main Text */}
                      <div className="pl-11">
                        {editingId === anno.id ? (
                          <div className="relative">
                            <textarea 
                              autoFocus 
                              className="w-full bg-background border border-border rounded-xl p-3 pr-10 text-[11px] font-medium focus:ring-1 focus:ring-primary/40 outline-none min-h-[80px] resize-none shadow-inner" 
                              value={editingText} 
                              onChange={e => setEditingText(e.target.value)} 
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSave(anno.id);
                                }
                              }}
                              onBlur={() => {
                                // Small delay to allow Check button or Color picks (which use onMouseDown preventDefault) to work
                                setTimeout(() => {
                                  if (editingId === anno.id) handleSave(anno.id);
                                }, 200);
                              }}
                            />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSave(anno.id)}
                              className="absolute top-2 right-2 p-1.5 bg-primary text-primary-foreground rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all outline-none"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap" onDoubleClick={() => !isReadOnly && startEditing(anno.id, anno.text)}>
                            {anno.text || <span className="text-muted-foreground/40 italic">Double-click to edit note...</span>}
                          </p>
                        )}
                        
                        {/* Dynamic Color Picker for existing annotation */}
                        {editingId === anno.id && !isReadOnly && (
                          <div className="mt-3 flex items-center gap-2 p-1.5 bg-muted/40 rounded-lg w-fit border border-border/50">
                             {PRESET_COLORS.map(c => (
                               <button
                                 key={c}
                                 onMouseDown={(e) => e.preventDefault()}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const next = annotations.map(a => a.id === anno.id ? {...a, color: c} : a);
                                   persistAnnotations(next);
                                 }}
                                 title="Change item color"
                                 className={cn(
                                   "w-3.5 h-3.5 rounded-full border transition-all hover:scale-125",
                                   (anno.color || "hsl(var(--primary))") === c ? "scale-125 shadow-md ring-2 ring-primary/20 border-foreground/30" : "border-background/50 shadow-sm border-transparent"
                                 )}
                                 style={{ backgroundColor: c }}
                               />
                             ))}
                          </div>
                        )}
                      </div>

                      {/* Replies */}
                      {anno.replies && anno.replies.length > 0 && (
                        <div className="pl-11 flex flex-col gap-3 mt-2">
                          {anno.replies.map(reply => (
                            <div key={reply.id} className="flex gap-3">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                                  {reply.userPhoto ? <img src={reply.userPhoto} className="w-full h-full object-cover"/> : <UserIcon size={10} className="text-muted-foreground/40"/>}
                              </div>
                              <div className="flex flex-col bg-muted/40 p-3 rounded-xl rounded-tl-none flex-1 border border-border/40 hover:border-border transition-colors">
                                <span className="text-[9px] font-black text-foreground uppercase tracking-wider mb-1">{reply.userName}</span>
                                <p className="text-[10px] font-medium text-muted-foreground whitespace-pre-wrap">
                                  {reply.text.split(/(@\w+)/g).map((chunk, i) => 
                                    chunk.startsWith('@') ? <span key={i} className="text-primary font-bold">{chunk}</span> : chunk
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Box */}
                      {activeAnnotationId === anno.id && !isReadOnly && (
                        <div className="pl-11 mt-3">
                           <div className="flex items-center gap-2">
                             <input 
                               value={replyText[anno.id] || ''}
                               onChange={(e) => setReplyText({ ...replyText, [anno.id]: e.target.value })}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                   e.preventDefault();
                                   if (replyText[anno.id]?.trim()) {
                                     const newReply = {
                                       id: Math.random().toString(36).substr(2, 9),
                                       text: replyText[anno.id].trim(),
                                       userName: user?.displayName || user?.email || "Anonymous",
                                       userPhoto: user?.photoURL || undefined,
                                       createdAt: new Date().toISOString()
                                     };
                                     const next = annotations.map(a => 
                                       a.id === anno.id ? { ...a, replies: [...(a.replies || []), newReply] } : a
                                     );
                                     onSave(next);
                                     setReplyText({ ...replyText, [anno.id]: '' });
                                   }
                                 }
                               }}
                               placeholder="Reply... (press enter to send)"
                               className="flex-1 bg-background border border-border/60 rounded-full px-4 py-2 text-[10px] font-bold focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50 shadow-sm"
                             />
                           </div>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>, document.body)}

      {/* Floating Toggle Button (Visible when Sidebar is closed) */}
      {createPortal(
        <AnimatePresence>
          {isMinimized && (
          <motion.div 
            initial={{ scale: 0, x: 50 }} 
            animate={{ scale: 1, x: 0 }} 
            exit={{ scale: 0, x: 50 }}
            className="fixed bottom-8 right-8 z-[99999] pointer-events-auto no-print"
          >
           <button
            onClick={() => setIsMinimized(false)}
            className="w-14 h-14 bg-background text-foreground border border-border shadow-xl rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none group"
           >
             <MessageSquare size={22} className="relative z-10 text-muted-foreground group-hover:text-foreground transition-colors" />
             {annotations.length > 0 && (
               <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full border-2 border-background flex items-center justify-center text-[10px] font-black z-20 shadow-sm animate-in zoom-in duration-300">
                 {annotations.length}
               </div>
             )}
           </button>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
};
