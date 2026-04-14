import React, { useEffect, useState, useRef, useMemo } from "react";
import { X, Download, ZoomIn, ZoomOut, RotateCw, Hand, Play, Pause, Minimize2, Maximize2 } from "../lib/icons/lucide";
import { type FileAttachment, type Annotation, type MemberRole } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AnnotationSystem } from "./AnnotationSystem";

interface FileViewerModalProps {
  file: FileAttachment | null;
  onClose: () => void;
  onSaveAnnotations?: (fileId: string, annotations: Annotation[]) => void;
  role?: MemberRole;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({ file, onClose, onSaveAnnotations, role }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const annotationRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [annotationMode, setAnnotationMode] = useState<'inspect' | 'pin' | 'highlight' | 'draw'>('inspect');

  // Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!constraintsRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(constraintsRef.current);
    return () => observer.disconnect();
  }, []);

  const dragConstraints = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return { left: 0, right: 0, top: 0, bottom: 0 };
    const scaledWidth = containerSize.width * zoom;
    const scaledHeight = containerSize.height * zoom;
    const xMax = Math.max(0, (scaledWidth - containerSize.width) / 2) + (containerSize.width * 0.25);
    const yMax = Math.max(0, (scaledHeight - containerSize.height) / 2) + (containerSize.height * 0.25);
    return { left: -xMax, right: xMax, top: -yMax, bottom: yMax };
  }, [containerSize, zoom]);

  useEffect(() => {
    if (!file || file.type !== "pdf" || !file.url.startsWith("data:")) {
      setBlobUrl(file?.url || null);
      return;
    }
    let currentUrl = "";
    const convert = async () => {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        setBlobUrl(file.url);
      }
    };
    convert();
    return () => { if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [file]);

  if (!file) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => { setZoom(1); setRotation(0); setIsPanning(false); };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderContent = () => {
    switch (file.type) {
      case "pdf":
        return blobUrl ? <embed src={`${blobUrl}#view=FitV&toolbar=1`} type="application/pdf" className="w-full h-full bg-white"/> : null;
      case "image":
        return <img src={file.url} alt={file.name} className="w-full h-full object-contain pointer-events-none select-none shadow-2xl rounded-lg"/>;
      case "video":
        return <video ref={videoRef} src={file.url} autoPlay onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} className="w-full h-full object-contain rounded-lg shadow-2xl outline-none"/>;
      default:
        return <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Unsupported file type</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-xl animate-in fade-in duration-300 no-print overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 relative z-20">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-foreground font-lexend">{file.name}</h2>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
            {file.type} • {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Unknown Size"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href={file.url} download={file.name} className="p-2 transition-all rounded-full hover:bg-muted text-muted-foreground hover:text-foreground active:scale-90"><Download size={18} /></a>
          <button onClick={onClose} className="p-2 transition-all rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive active:scale-90"><X size={20} /></button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden bg-black/20">
        <div ref={constraintsRef} className="flex-1 relative min-h-0 flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            drag={(isPanning || zoom > 1) && annotationMode === 'inspect'}
            dragConstraints={dragConstraints}
            dragMomentum={false}
            animate={{ scale: zoom, rotate: rotation }}
            className={cn(
              "relative z-10 w-full h-full max-w-screen-2xl mx-auto flex items-center justify-center select-none pointer-events-auto overflow-hidden",
              annotationMode === 'inspect' && (isPanning || zoom > 1) ? "cursor-grab active:cursor-grabbing" : ""
            )}
          >
             <div ref={annotationRef} className="w-full h-full flex items-center justify-center relative">
                {renderContent()}
                <AnnotationSystem 
                  annotations={file.annotations || []} 
                  onSave={(next) => onSaveAnnotations?.(file.id, next)}
                  containerRef={annotationRef}
                  currentTime={currentTime}
                  mediaType={file.type}
                  userRole={role}
                  onModeChange={setAnnotationMode}
                />
             </div>
          </motion.div>
        </div>

        {/* Toolbar Bridge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-card/95 backdrop-blur-xl rounded-full shadow-2xl border border-white/10">
            <button onClick={handleReset} className="px-4 py-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">Reset View</button>
            <div className="flex items-center gap-1 border-l border-border/50 pl-1">
              <button onClick={handleZoomOut} className="p-2 rounded-full hover:bg-muted"><ZoomOut size={14}/></button>
              <span className="text-[9px] font-black w-8 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="p-2 rounded-full hover:bg-muted"><ZoomIn size={14}/></button>
            </div>
            <button onClick={handleRotate} className="p-2 rounded-full hover:bg-muted border-l border-border/50"><RotateCw size={14}/></button>
        </div>

        {/* Video specific control bar if video */}
        {file.type === 'video' && (
           <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xl px-12 pointer-events-none">
              <div className="bg-card/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-border/50 pointer-events-auto space-y-2">
                 <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="p-2 bg-primary text-primary-foreground rounded-full">{isPlaying ? <Pause size={14}/> : <Play size={14}/>}</button>
                    <input type="range" min="0" max={duration} value={currentTime} onChange={(e) => videoRef.current && (videoRef.current.currentTime = Number(e.target.value))} className="flex-1 h-1 bg-muted accent-primary cursor-pointer"/>
                 </div>
                 <div className="flex justify-between text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
