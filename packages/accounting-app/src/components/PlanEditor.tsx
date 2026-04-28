import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSyncedStore } from '@syncedstore/react';
import { getYjsDoc } from '@syncedstore/core';
import { useAuth } from '../context/AuthContext';
import { CollaboratorsSheet } from './CollaboratorsSheet';
import {
  ArrowLeft,
  Hand,
  MousePointer2,
  PenTool,
  Check,
  X,
  ChevronRight,
  MapPin,
  Loader as Loader2,
  Trash,
  Palette,
  Layers,
  Square,
  Users,
  Settings2,
  Search
} from '../lib/icons/lucide';
import { cn } from '../lib/utils';
import { PdfViewer, type PdfViewerHandle } from './PdfViewer';
import { PlanPageOverlay } from './PlanPageOverlay';
import { type Zone, type Task } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { editorStore, connectEditor, authStore } from '../store';

// Helper for Point-in-Polygon (Ray Casting Algorithm)
function isPointInPolygon(point: {x: number, y: number}, polygon: {x: number, y: number}[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

export const PlanEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, projectId, businessId, businessName: authBusinessName } = useAuth();
  const state = useSyncedStore(editorStore);
  const authAction = useSyncedStore(authStore);

  const [isReady, setIsReady] = useState(false);
  const [isSyncReady, setIsSyncReady] = useState(false);

  // Collaboration State (from Editor.tsx)
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [myClientId, setMyClientId] = useState<string>("unknown");
  const [businessName, setBusinessName] = useState(authBusinessName || "Your Business");

  useEffect(() => {
    if (authBusinessName) setBusinessName(authBusinessName);
  }, [authBusinessName]);

  // UI State
  const [activeTool, setActiveTool] = useState<'view' | 'pan' | 'pen'>('view');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number, y: number }[]>([]);
  const [zoneColor, setZoneColor] = useState('#eab308');
  const [isDroppingPin, setIsDroppingPin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [draggingVertex, setDraggingVertex] = useState<{ zoneId: string, index: number } | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [zoneSearch, setZoneSearch] = useState('');

  // Modals
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({
    description: '',
    assignee: '',
    priority: 'med',
    status: 'pending'
  });
  const [pendingPinCoords, setPendingPinCoords] = useState<{ x: number, y: number } | null>(null);

  const pdfViewerRef = useRef<PdfViewerHandle>(null);

  // Collapse the per-zone config panel whenever a different zone is selected
  useEffect(() => {
    setIsConfigOpen(false);
  }, [selectedZoneId]);

  // Auto-scroll to zone centroid when selected
  useEffect(() => {
    if (selectedZoneId) {
      const zone = (plan.planData?.zones || []).find((z: Zone) => z.id === selectedZoneId);
      if (zone && zone.points.length > 0) {
        const avgX = zone.points.reduce((acc: number, p: any) => acc + p.x, 0) / zone.points.length;
        const avgY = zone.points.reduce((acc: number, p: any) => acc + p.y, 0) / zone.points.length;
        
        // Use a slight delay to ensure the page is rendered or resized
        setTimeout(() => {
          pdfViewerRef.current?.scrollToPosition(zone.pageNumber, avgX, avgY);
        }, 100);
      }
    }
  }, [selectedZoneId]);

  useEffect(() => {
    if (!id || !user || !projectId) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await user.getIdToken();
      const editorProvider = connectEditor(id, token);

      // Per-document presence — only users viewing THIS plan show up here.
      const updatePresence = () => {
        const states = editorProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            clients.push({
              id: clientId.toString(),
              user: state.user
            });
          }
        });
        setConnectedClients(clients);
      };

      editorProvider.awareness?.on('change', updatePresence);
      setMyClientId(editorProvider.awareness?.clientID.toString() || "unknown");
      editorProvider.awareness?.setLocalStateField('user', {
        name: user.displayName || "Anonymous",
        email: user.email || "guest@system.com",
        photo: user.photoURL,
        id: user.uid,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        docId: id,
      });

      // Seed the shared content from REST the first time someone opens the doc
      const seedIfEmpty = async () => {
        try {
          if (Object.keys(editorStore.content || {}).length > 0) {
            setIsReady(true);
            setIsSyncReady(true);
            return;
          }

          const all = await api.getDocuments(projectId);
          const found = all.find((d: any) => d.id === id);
          if (found?.content && Object.keys(editorStore.content || {}).length === 0) {
            Object.assign(editorStore.content, found.content);
            console.log('[PlanEditor] 📥 Seeded content from REST');
          }
          setIsReady(true);
          setIsSyncReady(true);
        } catch (e) {
          console.error('[PlanEditor] seed from REST failed', e);
          setIsReady(true);
          setIsSyncReady(true);
        }
      };

      editorProvider.on('synced', seedIfEmpty);
      // Safety net
      setTimeout(seedIfEmpty, 1000);

      cleanup = () => {
        editorProvider.awareness?.off('change', updatePresence);
        editorProvider.off('synced', seedIfEmpty);
        editorProvider.destroy();
      };
    };

    startSync();
    return () => cleanup?.();
  }, [id, user, projectId]);

  // --- Collaborative auto-save (from Editor.tsx) ---------------------------
  // Listen to Yjs updates on the editor doc and debounce a REST save so the
  // backend always has the latest snapshot (durable across refresh / cold
  // starts). Only a short debounce — Hocuspocus is the real-time transport,
  // REST is just the persistence layer.
  useEffect(() => {
    if (!id || !isSyncReady) return;
    const yDoc = getYjsDoc(editorStore);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSave = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (!editorStore.content || Object.keys(editorStore.content).length === 0) return;

          const snapshot = JSON.parse(JSON.stringify(editorStore.content));

          api.updateDocument(id, snapshot).catch(err =>
            console.warn('[PlanEditor] auto-save failed:', err)
          );
        } catch (e) {
          console.error('[PlanEditor] failed to snapshot content for auto-save', e);
        }
      }, 2000);
    };

    yDoc.on('update', scheduleSave);
    return () => {
      yDoc.off('update', scheduleSave);
      if (timer) clearTimeout(timer);
    };
  }, [id, isSyncReady]);

  const plan = state.content as any; // DocData with isPlan and planData

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#121214]">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Synchronizing Blueprint...</p>
        </div>
      </div>
    );
  }

  // If it's not a plan document, show an error or a simple PDF viewer
  if (isReady && !plan.isPlan) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#121214] text-white p-8 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
          <ArrowLeft size={24} className="text-white/20" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest mb-2">Invalid Document Type</h3>
        <p className="text-[10px] text-white/40 font-medium leading-relaxed max-w-[250px] uppercase tracking-[0.15em] mb-8">
          This document was not initialized as a construction plan.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const zones = plan.planData?.zones || [];

  // Full-text filter across zone name, task description, and assignee
  const filteredZones = useMemo(() => {
    const q = zoneSearch.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z: Zone) =>
      (z.name || '').toLowerCase().includes(q) ||
      (z.tasks || []).some((t: Task) =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.assignee || '').toLowerCase().includes(q)
      )
    );
  }, [zones, zoneSearch]);

  // --- Zone Drawing Logic ---
  const handlePageClick = (pageNum: number, e: React.MouseEvent, coords: { x: number, y: number }) => {
    // Drop-pin mode takes priority over any active tool — once Add Task is
    // armed, the very next page click should drop the pin, no tool switch needed.
    if (isDroppingPin && selectedZoneId) {
      const zone = zones.find((z: Zone) => z.id === selectedZoneId);
      if (zone && !isPointInPolygon(coords, zone.points)) {
        alert("Cannot drop task outside the selected zone boundaries.");
        setIsDroppingPin(false);
        return;
      }
      setPendingPinCoords(coords);
      setCurrentPage(pageNum);
      setShowTaskModal(true);
      setIsDroppingPin(false);
      return;
    }

    if (activeTool === 'pen') {
      if (currentPoints.length > 2) {
        // Snap to start point if close enough
        const start = currentPoints[0];
        const dist = Math.sqrt(Math.pow(coords.x - start.x, 2) + Math.pow(coords.y - start.y, 2));
        if (dist < 2) { // 2% threshold
          finishZoneDrawing(pageNum);
          return;
        }
      }
      setCurrentPoints([...currentPoints, coords]);
      setCurrentPage(pageNum);
    }
  };

  const handleMouseMove = (pageNum: number, e: React.MouseEvent, coords: { x: number, y: number }) => {
    if (draggingVertex) {
      const { zoneId, index } = draggingVertex;
      const zoneIdx = zones.findIndex((z: Zone) => z.id === zoneId);
      if (zoneIdx !== -1) {
        const zone = plan.planData.zones[zoneIdx];
        if (zone && zone.points) {
          // Replace the entire array to ensure compatibility with SyncedStore/Yjs
          const nextPoints = [...zone.points];
          nextPoints[index] = coords;
          zone.points = nextPoints;
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (draggingVertex) {
      setDraggingVertex(null);
    }
  };

  const handleZoneDoubleClick = (zoneId: string) => {
    const zone = (plan.planData?.zones || []).find((z: Zone) => z.id === zoneId);
    if (zone && zone.points.length > 0) {
      const avgX = zone.points.reduce((acc: number, p: any) => acc + p.x, 0) / zone.points.length;
      const avgY = zone.points.reduce((acc: number, p: any) => acc + p.y, 0) / zone.points.length;
      
      // Zoom in and center on the zone
      pdfViewerRef.current?.scrollToPosition(zone.pageNumber, avgX, avgY, 2.0);
    }
  };

  const finishZoneDrawing = (pageNum: number) => {
    if (currentPoints.length < 3) return;
    setShowZoneModal(true);
  };

  const createZone = () => {
    if (!newZoneName.trim()) return;
    const newZone: Zone = {
      id: Math.random().toString(36).substr(2, 9),
      name: newZoneName,
      color: zoneColor,
      points: [...currentPoints], // Create a fresh copy for the sync store
      tasks: [],
      pageNumber: currentPage
    };

    if (!plan.planData) plan.planData = { pdfUrl: plan.pdfUrl || '', zones: [] };
    plan.planData.zones.push(newZone);

    setNewZoneName('');
    setCurrentPoints([]);
    setShowZoneModal(false);
    setSelectedZoneId(newZone.id);
    setActiveTool('view');
  };

  const createTask = () => {
    if (!selectedZoneId || !pendingPinCoords) return;
    const zoneIndex = zones.findIndex((z: Zone) => z.id === selectedZoneId);
    if (zoneIndex === -1) return;

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      description: newTaskData.description || 'New Task',
      assignee: newTaskData.assignee || 'Unassigned',
      priority: newTaskData.priority || 'med',
      status: 'pending',
      x: pendingPinCoords.x,
      y: pendingPinCoords.y,
      pageNumber: currentPage,
      dueDate: newTaskData.dueDate
    };

    plan.planData.zones[zoneIndex].tasks.push(newTask);
    setShowTaskModal(false);
    setPendingPinCoords(null);
    setNewTaskData({ description: '', assignee: '', priority: 'med', status: 'pending' });
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-lexend">
      {/* --- Toolbar Header --- */}
      <header className="h-14 border-b border-white/5 bg-[#18181b] flex items-center justify-between px-6 shrink-0 z-[100] shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/50 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="h-6 w-px bg-white/10" />
          <h1 className="text-sm font-black uppercase tracking-widest">{plan.name}</h1>
        </div>

        <div className="flex items-center gap-4">
           {/* Navigation & Title */}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollaboratorsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest shadow-sm relative group"
          >
            <Users size={12} />
            {connectedClients.length > 1 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-card" />
            )}
            Collabs
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Viewer - Expanded to fill space previously used by left sidebar */}
        <main className="flex-1 relative bg-[#121214]">
          <div className="absolute inset-0">
            <PdfViewer
              ref={pdfViewerRef}
              url={plan.planData?.pdfUrl || plan.content?.url}
              className="h-full"
              role={user ? 'editor' : 'viewer'}
              onPageClick={handlePageClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              activeTool={activeTool}
              onPageChange={setCurrentPage}
              renderOverlay={(pageNum) => (
                <PlanPageOverlay
                  zones={zones}
                  pageNumber={pageNum}
                  selectedZoneId={selectedZoneId}
                  onZoneClick={setSelectedZoneId}
                  currentPoints={currentPage === pageNum ? currentPoints : []}
                  activeColor={zoneColor}
                  onVertexMouseDown={(zoneId, index) => setDraggingVertex({ zoneId, index })}
                  onZoneDoubleClick={handleZoneDoubleClick}
                  isReadOnly={activeTool === 'pan' || isDroppingPin}
                />
              )}
            />

            {/* --- Floating Toolbar --- */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-card/80 backdrop-blur-2xl p-1.5 rounded-[20px] border border-border shadow-2xl">
              <ToolbarButton
                active={activeTool === 'view'}
                onClick={() => setActiveTool('view')}
                icon={<MousePointer2 size={16} className="text-current" />}
                label="Select"
              />
              <div className="w-px h-6 bg-border/60 mx-1" />
              <ToolbarButton
                active={activeTool === 'pan'}
                onClick={() => setActiveTool('pan')}
                icon={<Hand size={16} className="text-current" />}
                label="Pan"
              />
              <div className="w-px h-6 bg-border/60 mx-1" />
              <ToolbarButton
                active={activeTool === 'pen'}
                onClick={() => setActiveTool('pen')}
                icon={<PenTool size={16} className="text-current" />}
                label="Draw"
              />
              
              {isDrawing && currentPoints.length > 0 && (
                <>
                  <div className="w-px h-6 bg-white/5 mx-1" />
                  <button 
                    onClick={() => finishZoneDrawing(currentPage)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
                  >
                    <Check size={14} /> Finish
                  </button>
                  <button 
                    onClick={() => { setIsDrawing(false); setCurrentPoints([]); }}
                    className="flex items-center justify-center p-2 rounded-xl bg-white/5 text-white/40 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>

          </div>
        </main>

        {/* --- Consolidated Sidebar (Zones + Tasks) --- */}
        <aside className="w-72 lg:w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-border flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Zones &amp; Tasks</h2>
              {zones.length > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground/70 tabular-nums">
                  {zoneSearch ? `${filteredZones.length}/${zones.length}` : zones.length}
                </span>
              )}
            </div>
            {zones.length > 0 && (
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
                <input
                  type="text"
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder="Search zones &amp; tasks…"
                  className="w-full bg-muted/40 border border-transparent rounded-lg pl-7 pr-7 py-1.5 text-[11px] font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-border focus:bg-background transition-all"
                />
                {zoneSearch && (
                  <button
                    onClick={() => setZoneSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/60 hover:text-foreground"
                    title="Clear search"
                  >
                    <X size={11} className="text-current" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 custom-scrollbar">
            {zones.length === 0 ? (
              <div className="py-16 text-center">
                <PenTool className="mx-auto mb-3 text-muted-foreground/30" size={36} />
                <p className="text-[11px] font-semibold text-muted-foreground/70 max-w-[200px] mx-auto leading-relaxed">
                  Use the Draw tool to define areas on the plan
                </p>
              </div>
            ) : filteredZones.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
                  <Search size={16} className="text-current" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">No matches</p>
                <button onClick={() => setZoneSearch('')} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">Clear search</button>
              </div>
            ) : (
              filteredZones.map((zone: Zone) => {
                const isSelected = selectedZoneId === zone.id;
                return (
                  <div
                    key={zone.id}
                    className={cn(
                      "rounded-xl border transition-all overflow-hidden",
                      isSelected
                        ? "bg-muted/50 border-border shadow-sm"
                        : "bg-muted/20 border-transparent hover:bg-muted/40"
                    )}
                  >
                    {/* Zone Header */}
                    <div
                      onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
                      className="px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: zone.color }} />
                        <div className="min-w-0">
                          <h3 className="text-xs font-black uppercase tracking-tight truncate group-hover:text-primary transition-colors">{zone.name}</h3>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                            Pg {zone.pageNumber} · {zone.tasks.length} {zone.tasks.length === 1 ? 'Task' : 'Tasks'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextZones = zones.filter((z: Zone) => z.id !== zone.id);
                              plan.planData.zones = nextZones;
                              setSelectedZoneId(null);
                            }}
                            className="p-1.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded-lg transition-all"
                          >
                            <Trash size={13} />
                          </button>
                        )}
                        <ChevronRight size={15} className={cn("text-muted-foreground/60 transition-transform duration-300", isSelected ? "rotate-90" : "group-hover:translate-x-0.5")} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border bg-background/30"
                        >
                          <div className="p-3 space-y-3">
                            {/* Action row: Config toggle + Drop Task Pin */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setIsConfigOpen(v => !v)}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                  isConfigOpen
                                    ? "bg-foreground text-background border-transparent shadow-md"
                                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                                )}
                              >
                                <Settings2 size={13} className="text-current" /> Config
                              </button>
                              <button
                                onClick={() => setIsDroppingPin(v => !v)}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                  isDroppingPin
                                    ? "bg-amber-500 text-black border-transparent shadow-md shadow-amber-500/20 animate-pulse"
                                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                                )}
                              >
                                <MapPin size={13} className="text-current" /> {isDroppingPin ? 'Tap in zone' : 'Add Task'}
                              </button>
                            </div>

                            {/* Zone Styling — collapsible, flat, dense */}
                            <AnimatePresence initial={false}>
                              {isConfigOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2.5 pb-3 border-b border-border">
                              {/* Fill */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Palette size={11} className="text-muted-foreground" />
                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fill</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {['#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => {
                                        const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                        plan.planData.zones[zIdx].color = c;
                                      }}
                                      className={cn(
                                        "w-3.5 h-3.5 rounded-full border transition-all",
                                        zone.color === c ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-110"
                                      )}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={zone.color}
                                    onChange={(e) => {
                                      const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                      plan.planData.zones[zIdx].color = e.target.value;
                                    }}
                                    className="w-4 h-4 rounded bg-transparent border-0 p-0 cursor-pointer"
                                    title="Custom color"
                                  />
                                </div>
                              </div>

                              {/* Border */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Square size={11} className="text-muted-foreground" />
                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Border</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {['#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => {
                                        const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                        plan.planData.zones[zIdx].borderColor = c;
                                      }}
                                      className={cn(
                                        "w-3.5 h-3.5 rounded-full border transition-all",
                                        (zone.borderColor || zone.color) === c ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-110"
                                      )}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={zone.borderColor || zone.color}
                                    onChange={(e) => {
                                      const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                      plan.planData.zones[zIdx].borderColor = e.target.value;
                                    }}
                                    className="w-4 h-4 rounded bg-transparent border-0 p-0 cursor-pointer"
                                    title="Custom border"
                                  />
                                </div>
                              </div>

                              {/* Border width */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                    <PenTool size={11} />
                                    <span>Width</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{(zone.strokeWidth ?? 0.2).toFixed(1)}</span>
                                </div>
                                <input
                                  type="range" min="0.1" max="2" step="0.1"
                                  value={zone.strokeWidth ?? 0.2}
                                  onChange={(e) => {
                                    const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                    plan.planData.zones[zIdx].strokeWidth = parseFloat(e.target.value);
                                  }}
                                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                              </div>

                              {/* Opacity */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                    <Layers size={11} />
                                    <span>Opacity</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{Math.round((zone.opacity ?? 0.1) * 100)}%</span>
                                </div>
                                <input
                                  type="range" min="0.05" max="0.8" step="0.05"
                                  value={zone.opacity ?? 0.1}
                                  onChange={(e) => {
                                    const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                    plan.planData.zones[zIdx].opacity = parseFloat(e.target.value);
                                  }}
                                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                              </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="space-y-1.5">
                              {zone.tasks.length === 0 ? (
                                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest text-center py-3">No tasks yet</p>
                              ) : (
                                zone.tasks.map((task: Task) => (
                                  <div key={task.id} className="pl-3 pr-2 py-2 bg-muted/40 rounded-lg group/task relative overflow-hidden hover:bg-muted/60 transition-colors">
                                    <div className={cn(
                                      "absolute left-0 top-0 bottom-0 w-0.5",
                                      task.priority === 'high' ? 'bg-destructive' : task.priority === 'med' ? 'bg-amber-500' : 'bg-blue-500'
                                    )} />
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{task.status}</span>
                                      <button
                                        onClick={() => {
                                          const nextTasks = zone.tasks.filter((t: Task) => t.id !== task.id);
                                          const zIdx = zones.findIndex((z: Zone) => z.id === zone.id);
                                          plan.planData.zones[zIdx].tasks = nextTasks;
                                        }}
                                        className="opacity-0 group-hover/task:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                                      >
                                        <X size={11} />
                                      </button>
                                    </div>
                                    <h4 className="text-[11px] font-bold leading-snug mb-1.5 line-clamp-2">{task.description}</h4>
                                    <div className="flex items-center justify-between gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                      <span className="truncate min-w-0">{task.assignee}</span>
                                      {task.dueDate && <span className="shrink-0 tabular-nums">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Collaborators Sheet (from Editor.tsx) */}
      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients}
        ownerId={null}
        businessId={businessId}
        businessName={businessName}
        initialTab={activeCollaboratorTab}
        bannedClients={authAction.bannedClients}
        onBanClient={(email) => {
          if (!authAction.bannedClients.includes(email)) {
            authAction.bannedClients.push(email);
          }
        }}
      />

      {/* --- Modals --- */}
      <AnimatePresence>
        {showZoneModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#18181b] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-lg font-black uppercase tracking-tight mb-1">Define New Zone</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-6">Give this area a name for your team</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Zone Name</label>
                  <input
                    autoFocus
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="e.g. Ground Floor Plumbing"
                    className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl focus:ring-1 ring-primary outline-none text-sm font-bold transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => { setShowZoneModal(false); setCurrentPoints([]); }}
                    className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-white/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createZone}
                    className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Create Zone
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showTaskModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#18181b] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-lg font-black uppercase tracking-tight mb-1">Assign Task</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-6">Drop a work order at this location</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Description</label>
                  <input
                    autoFocus
                    value={newTaskData.description}
                    onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                    placeholder="e.g. Install overhead ducting"
                    className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Assignee</label>
                    <input
                      value={newTaskData.assignee}
                      onChange={(e) => setNewTaskData({ ...newTaskData, assignee: e.target.value })}
                      placeholder="Name"
                      className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Priority</label>
                    <select
                      value={newTaskData.priority}
                      onChange={(e) => setNewTaskData({ ...newTaskData, priority: e.target.value as any })}
                      className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                    >
                      <option value="low">Low</option>
                      <option value="med">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={newTaskData.dueDate}
                    onChange={(e) => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
                    className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                  />
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    onClick={() => { setShowTaskModal(false); setPendingPinCoords(null); }}
                    className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-white/50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTask}
                    className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest",
      active
        ? "bg-foreground text-background shadow-lg scale-105 z-10"
        : "text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-105"
    )}
  >
    {icon}
    <span className="hidden md:inline">{label}</span>
  </button>
);
