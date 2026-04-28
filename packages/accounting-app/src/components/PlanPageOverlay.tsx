import React from 'react';
import { type Zone, type Task } from '../types';
import { cn } from '../lib/utils';
import { MapPin, User as UserIcon } from '../lib/icons/lucide';

interface PlanPageOverlayProps {
  zones: Zone[];
  pageNumber: number;
  selectedZoneId: string | null;
  onZoneClick: (zoneId: string) => void;
  onTaskClick?: (taskId: string) => void;
  currentPoints?: { x: number, y: number }[]; // For active drawing
  activeColor?: string;
  onVertexMouseDown?: (zoneId: string, vertexIndex: number, e: React.MouseEvent) => void;
  onZoneDoubleClick?: (zoneId: string) => void;
  isReadOnly?: boolean;
}

export const PlanPageOverlay: React.FC<PlanPageOverlayProps> = ({
  zones,
  pageNumber,
  selectedZoneId,
  onZoneClick,
  onTaskClick,
  currentPoints,
  activeColor,
  onVertexMouseDown,
  onZoneDoubleClick,
  isReadOnly
}) => {
  const pageZones = zones.filter(z => z.pageNumber === pageNumber);

  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-visible">
      {/* ── Zone Labels (HTML Layer) ────────────────────────────────── */}
      {pageZones.map(zone => {
        if (zone.id !== selectedZoneId || zone.points.length === 0) return null;
        
        // Find the top-most point for label positioning
        const minX = Math.min(...zone.points.map(p => p.x));
        const minY = Math.min(...zone.points.map(p => p.y));
        
        return (
          <div 
            key={`label-${zone.id}`}
            className="absolute z-[70] pointer-events-none"
            style={{ 
              left: `${minX}%`, 
              top: `${minY}%`, 
              transform: 'translateY(calc(-100% - 6px))' // 3px floating offset + padding
            }}
          >
            <div 
              className="px-3 py-1 rounded-full text-[9px] font-semibold whitespace-nowrap shadow-2xl flex items-center gap-2 border border-white/20 backdrop-blur-md"
              style={{ 
                backgroundColor: zone.borderColor || zone.color,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {zone.name}
            </div>
          </div>
        );
      })}

      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Render existing zones */}
        {pageZones.map((zone) => {
          if (zone.points.length < 2) return null;
          const pointsString = zone.points
            .map(p => `${p.x},${p.y}`)
            .join(' ');
          
          const isSelected = zone.id === selectedZoneId;

          return (
            <g 
              key={zone.id} 
              className={cn(
                "cursor-pointer",
                isReadOnly ? "pointer-events-none" : "pointer-events-auto"
              )}
              onClick={(e) => {
                if (isReadOnly) return;
                e.stopPropagation();
                onZoneClick(zone.id);
              }}
              onDoubleClick={(e) => {
                if (isReadOnly) return;
                e.stopPropagation();
                onZoneDoubleClick?.(zone.id);
              }}
            >
              <polygon
                points={pointsString}
                fill={zone.color}
                fillOpacity={isSelected ? (zone.opacity ?? 0.3) : 0.5}
                stroke={zone.borderColor || zone.color}
                strokeWidth={zone.strokeWidth ?? (isSelected ? 0.5 : 0.2)}
                className="transition-all duration-300"
                vectorEffect="non-scaling-stroke"
                style={{ mixBlendMode: 'multiply' }}
              />
              {/* Vertex Nodes for Adjustment */}
              {isSelected && !isReadOnly && zone.points.map((p, idx) => (
                <circle 
                   key={idx}
                   cx={p.x}
                   cy={p.y}
                   r={0.6}
                   fill="#fff"
                   stroke={zone.borderColor || zone.color}
                   strokeWidth={1}
                   vectorEffect="non-scaling-stroke"
                   className="cursor-move pointer-events-auto"
                   onMouseDown={(e) => {
                     e.stopPropagation();
                     onVertexMouseDown?.(zone.id, idx, e);
                   }}
                />
              ))}
            </g>
          );
        })}

        {/* Render active drawing points */}
        {currentPoints && currentPoints.length > 0 && (
          <g>
            <polyline
              points={currentPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={activeColor || '#eab308'}
              strokeWidth={0.3}
              strokeDasharray="1 0.5"
              vectorEffect="non-scaling-stroke"
            />
            {currentPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={0.5}
                fill={i === 0 ? '#fff' : (activeColor || '#eab308')}
                stroke={activeColor || '#eab308'}
                strokeWidth={0.1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}
      </svg>

      {/* Render Task Pins */}
      {pageZones.map(zone => 
        zone.tasks.map(task => {
          if (task.x === undefined || task.y === undefined) return null;
          const isSelected = zone.id === selectedZoneId;
          
          return (
            <div
              key={task.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-300",
                isSelected ? "scale-110 z-10" : "scale-100 opacity-60 hover:opacity-100"
              )}
              style={{ left: `${task.x}%`, top: `${task.y}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onZoneClick(zone.id);
                if (onTaskClick) onTaskClick(task.id);
              }}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xl transition-colors",
                task.status === 'done' ? 'bg-emerald-500' : 
                task.status === 'progress' ? 'bg-amber-500' : 'bg-red-500'
              )}>
                <MapPin size={12} className="text-white" />
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none border border-white/10 transition-opacity">
                {task.description}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
