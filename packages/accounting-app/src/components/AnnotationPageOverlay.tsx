/**
 * AnnotationPageOverlay
 *
 * Renders the visual annotation layer (highlights, draws, pins) for a single
 * PDF page, plus the draw/click capture overlay for that page.
 * Sidebar state is managed by AnnotationSystem via AnnotationContext.
 */
import React, { useState } from 'react';
import { type Annotation } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useAnnotationContext } from './AnnotationContext';

// ─── helpers (duplicated from AnnotationSystem to avoid circular deps) ────────
const getSmoothedPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    d += ` Q ${p1.x} ${p1.y} ${(p1.x + p2.x) / 2} ${(p1.y + p2.y) / 2}`;
  }
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
};

const getCursor = (mode: string) => {
  let svg = '', hotspot = '0 24';
  if (mode === 'draw') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    hotspot = '0 28';
  } else if (mode === 'pin') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
    hotspot = '14 28';
  } else if (mode === 'highlight') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;
    hotspot = '0 28';
  } else {
    return 'default';
  }
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") ${hotspot}, crosshair`;
};
// ─────────────────────────────────────────────────────────────────────────────

interface AnnotationPageOverlayProps {
  /** Full annotation list — overlay filters to this page, saves back merged */
  annotations: Annotation[];
  onSave: (next: Annotation[]) => void;
  pageNumber: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReadOnly?: boolean;
}

export const AnnotationPageOverlay: React.FC<AnnotationPageOverlayProps> = ({
  annotations,
  onSave,
  pageNumber,
  containerRef,
  isReadOnly = false,
}) => {
  const { user } = useAuth();
  const ctx = useAnnotationContext();

  const {
    activeAnnotationId, setActiveAnnotationId,
    activeMode, setActiveMode,
    activeColor,
    toolConfig,
    setIsMinimized,
    setEditingId,
    relocatingAnnotation, setRelocatingAnnotation,
  } = ctx;

  // Per-page local draw state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Annotations for this page only
  const pageAnnotations = annotations.filter(a => (a.pageNumber || 1) === pageNumber);

  // ── coordinate helpers ──────────────────────────────────────────────────
  const toPercent = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  // ── place pin ───────────────────────────────────────────────────────────
  const placePinAt = (clientX: number, clientY: number) => {
    const pos = toPercent(clientX, clientY);
    if (!pos) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newAnno: Annotation = {
      id: newId, x: pos.x, y: pos.y,
      text: '', userName: user?.displayName || user?.email || 'Anonymous',
      userPhoto: user?.photoURL || undefined,
      createdAt: new Date().toISOString(),
      type: 'pin', color: activeColor,
      pinSize: toolConfig.pin.size,
      replies: [], pageNumber,
    };
    onSave([...annotations, newAnno]);
    setActiveMode('inspect');
    setIsMinimized(false);
    setEditingId(newId);
    setActiveAnnotationId(newId);
  };

  // ── confirm / cancel relocation ─────────────────────────────────────────
  const confirmRelocation = () => {
    if (!relocatingAnnotation) return;
    onSave(annotations.map(a =>
      a.id === relocatingAnnotation.id ? { ...a, x: relocatingAnnotation.x, y: relocatingAnnotation.y } : a
    ));
    setRelocatingAnnotation(null);
  };
  const cancelRelocation = () => setRelocatingAnnotation(null);

  // ── select annotation ───────────────────────────────────────────────────
  const selectAnnotation = (id: string) => {
    setActiveAnnotationId(id);
    setIsMinimized(false);
    const card = document.getElementById(`comment-card-${id}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── inline index for numbering (across all non-draw annotations) ────────
  const allPins = annotations.filter(a => a.type !== 'draw');
  const getIndex = (id: string) => allPins.findIndex(a => a.id === id) + 1;

  const isActiveMode = activeMode !== 'inspect';

  return (
    <div className="absolute inset-0 pointer-events-none z-10">

      {/* ── Event capture overlay (draw / pin / highlight) ─── */}
      {!isReadOnly && isActiveMode && (
        <div
          className="absolute inset-0 z-[90] pointer-events-auto"
          style={{ cursor: getCursor(activeMode) }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (activeMode === 'draw' || activeMode === 'highlight') {
              setIsDrawing(true);
              const pos = toPercent(e.clientX, e.clientY);
              if (pos) setCurrentPath([pos]);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            const pos = toPercent(e.clientX, e.clientY);
            if (pos) {
              setMousePos(pos);
              if (isDrawing && (activeMode === 'draw' || activeMode === 'highlight')) {
                setCurrentPath(prev => [...prev, pos]);
              }
            }
          }}
          onPointerUp={(e) => {
            if (isDrawing && (activeMode === 'draw' || activeMode === 'highlight')) {
              setIsDrawing(false);
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              if (currentPath.length > 2) {
                const newId = Math.random().toString(36).substr(2, 9);
                const newAnno: Annotation = {
                  id: newId,
                  x: currentPath[0].x, y: currentPath[0].y,
                  text: '', userName: user?.displayName || user?.email || 'Anonymous',
                  userPhoto: user?.photoURL || undefined,
                  createdAt: new Date().toISOString(),
                  type: activeMode === 'highlight' ? 'highlight' : 'draw',
                  path: currentPath,
                  color: activeColor,
                  strokeWidth: activeMode === 'highlight'
                    ? toolConfig.highlight.thickness
                    : toolConfig.draw.thickness,
                  replies: [], pageNumber,
                };
                onSave([...annotations, newAnno]);
                setActiveMode('inspect');
                setIsMinimized(false);
                setEditingId(newId);
                setActiveAnnotationId(newId);
              }
              setCurrentPath([]);
            }
          }}
          onClick={(e) => {
            if (activeMode === 'pin') placePinAt(e.clientX, e.clientY);
          }}
          onMouseLeave={() => setMousePos(null)}
        />
      )}

      {/* ── Ghost cursor ──────────────────────────────────────── */}
      {mousePos && isActiveMode && activeMode !== 'draw' && !isDrawing && (
        <div
          className="absolute pointer-events-none z-[91]"
          style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%`, transform: 'translate(-50%,-50%)' }}
        >
          {activeMode === 'pin'
            ? <div className="w-12 h-12 rounded-full border-2 border-white bg-white/10 animate-pulse" />
            : <div className="w-12 h-12 rounded-full border-2 border-white bg-white/20 animate-pulse mix-blend-overlay" />}
        </div>
      )}

      {/* ── SVG: highlights + draws + live preview ────────────── */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
      >
        {/* Highlights */}
        {pageAnnotations.filter(a => a.type === 'highlight' && a.path).map(anno => {
          const sw = anno.strokeWidth ?? toolConfig.highlight.thickness;
          const isActive = activeAnnotationId === anno.id;
          return (
            <g key={anno.id} onClick={() => selectAnnotation(anno.id)} className="pointer-events-auto cursor-pointer">
              <path d={getSmoothedPath(anno.path!)} fill="none" stroke="transparent" strokeWidth={sw + 10} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path
                d={getSmoothedPath(anno.path!)} fill="none"
                stroke={anno.color || 'hsl(var(--primary))'} strokeWidth={sw}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                style={{ opacity: isActive ? 0.45 : 0.28, mixBlendMode: 'multiply' }}
                className="transition-opacity"
              />
            </g>
          );
        })}

        {/* Freehand draws */}
        {pageAnnotations.filter(a => a.type === 'draw' && a.path).map(anno => {
          const sw = anno.strokeWidth ?? toolConfig.draw.thickness;
          const isActive = activeAnnotationId === anno.id;
          return (
            <g key={anno.id} onClick={() => selectAnnotation(anno.id)} className="pointer-events-auto cursor-pointer">
              <path d={getSmoothedPath(anno.path!)} fill="none" stroke="transparent" strokeWidth={sw + 12} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path
                d={getSmoothedPath(anno.path!)} fill="none"
                stroke={anno.color || 'currentColor'} strokeWidth={isActive ? sw + 1 : sw}
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 6"
                vectorEffect="non-scaling-stroke"
                className={cn('transition-all text-primary', isActive ? 'opacity-100 drop-shadow-md' : 'opacity-50 hover:opacity-80')}
              />
            </g>
          );
        })}

        {/* Live preview while drawing */}
        {isDrawing && currentPath.length > 0 && (
          <path
            d={getSmoothedPath(currentPath)} fill="none"
            stroke={activeColor}
            strokeWidth={activeMode === 'highlight' ? toolConfig.highlight.thickness : toolConfig.draw.thickness}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={activeMode === 'highlight' ? undefined : '2 6'}
            vectorEffect="non-scaling-stroke"
            style={{ opacity: activeMode === 'highlight' ? 0.3 : 1, mixBlendMode: activeMode === 'highlight' ? 'multiply' : 'normal' }}
          />
        )}
      </svg>

      {/* ── Pin dots ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
        {pageAnnotations.filter(a => a.type === 'pin').map(anno => {
          const isRelocating = relocatingAnnotation?.id === anno.id;
          const isActive = activeAnnotationId === anno.id;
          const ps = anno.pinSize ?? toolConfig.pin.size;
          const fontSize = Math.max(8, Math.round(ps * 0.23));
          const idx = getIndex(anno.id);

          return (
            <motion.div
              key={anno.id}
              initial={{ scale: 0, opacity: 0, x: '-50%', y: '-50%' }}
              animate={{
                scale: isActive ? 1.2 : 1, opacity: 1, x: '-50%', y: '-50%',
                left: isRelocating ? `${relocatingAnnotation!.x}%` : `${anno.x}%`,
                top:  isRelocating ? `${relocatingAnnotation!.y}%` : `${anno.y}%`,
                zIndex: isActive ? 100 : 40,
              }}
              drag={!isReadOnly && activeMode === 'inspect'}
              dragMomentum={false} dragElastic={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                selectAnnotation(anno.id);
              }}
              onPointerUp={(e) => { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }}
              onDragEnd={(_, info) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setRelocatingAnnotation({
                  id: anno.id,
                  x: ((info.point.x - rect.left) / rect.width) * 100,
                  y: ((info.point.y - rect.top) / rect.height) * 100,
                  originalX: anno.x, originalY: anno.y,
                });
              }}
              className={cn('absolute group pointer-events-auto', !isReadOnly && 'cursor-grab active:cursor-grabbing')}
              style={{ touchAction: 'none' }}
            >
              {/* Relocation confirm */}
              {isRelocating && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 flex flex-col items-center gap-2 z-[100]">
                  <div className="bg-primary/95 text-primary-foreground text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-2xl border border-white/20 backdrop-blur-md">Confirm Move?</div>
                  <div className="flex items-center gap-1.5 p-1 bg-card/95 backdrop-blur-md rounded-full shadow-xl border border-border/50">
                    <button onClick={confirmRelocation} className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-[8px] font-black uppercase">Yes</button>
                    <button onClick={cancelRelocation}  className="px-3 py-1 hover:bg-muted text-foreground rounded-full text-[8px] font-black uppercase">No</button>
                  </div>
                </div>
              )}

              {/* Pin circle */}
              <div
                className={cn('rounded-full border-2 transition-all duration-300 flex items-center justify-center', isActive ? 'shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'shadow-sm')}
                style={{
                  width: ps, height: ps,
                  borderColor: anno.color || 'rgba(255,255,255,0.4)',
                  backgroundColor: anno.color ? `${anno.color}33` : 'rgba(255,255,255,0.05)',
                  mixBlendMode: anno.color ? 'normal' : 'exclusion',
                }}
              >
                <span style={{ fontSize, color: anno.color || 'white' }} className="font-black">{idx}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};
