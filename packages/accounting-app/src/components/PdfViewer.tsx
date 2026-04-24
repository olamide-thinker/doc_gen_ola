import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { AlertCircle, ZoomIn, ZoomOut, RotateCw, Download, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnnotationSystem } from './AnnotationSystem';
import { AnnotationPageOverlay } from './AnnotationPageOverlay';
import { AnnotationProvider, useAnnotationContext } from './AnnotationContext';
import { type Annotation, type MemberRole } from '../types';

// ── Worker setup ──────────────────────────────────────────────────────────────
const CDN_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
} catch {
  pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
}
window.addEventListener('error', (e) => {
  const msg = typeof e.message === 'string' ? e.message : '';
  if (msg.includes('pdf.worker') && pdfjs.GlobalWorkerOptions.workerSrc !== CDN_WORKER) {
    pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
  }
});

// ─────────────────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  url: string;
  annotations?: Annotation[];
  onSaveAnnotations?: (next: Annotation[]) => void;
  role?: MemberRole;
  zoom?: number;
  rotation?: number;
  className?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  annotations = [],
  onSaveAnnotations,
  role,
  zoom: initialZoom = 1,
  rotation: initialRotation = 0,
  className,
}) => {
  const [numPages, setNumPages]     = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageWidth, setPageWidth]   = useState<number>(0);
  const [zoom, setZoom]             = useState(initialZoom);
  const [rotation, setRotation]     = useState(initialRotation);

  const containerRef = useRef<HTMLDivElement>(null);   // outer wrapper
  const scrollRef    = useRef<HTMLDivElement>(null);   // scrollable area
  const pageRefs     = useRef<(HTMLDivElement | null)[]>([]);

  // ── Compute page width from container ────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setPageWidth((containerRef.current.clientWidth - 64) * zoom);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [zoom]);

  // ── IntersectionObserver → track visible page ─────────────────────────
  useEffect(() => {
    if (!numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the page with largest intersection ratio
        let best = 0, bestPage = currentPage;
        entries.forEach((entry) => {
          if (entry.intersectionRatio > best) {
            best = entry.intersectionRatio;
            bestPage = Number((entry.target as HTMLElement).dataset.page);
          }
        });
        if (best > 0) setCurrentPage(bestPage);
      },
      { root: scrollRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.slice(0, numPages).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [numPages, pageWidth]); // re-run when pages re-render due to zoom

  // ── Jump to page (from sidebar annotation select) ────────────────────
  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current[page - 1];
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url; a.download = 'document.pdf'; a.click();
  };

  return (
    <AnnotationProvider>
      {/* Wire up scrollToPage into the shared context */}
      <ScrollToPageBridge scrollToPage={scrollToPage} />

      <div
        ref={containerRef}
        className={cn('flex flex-col h-full w-full bg-[#323639] overflow-hidden relative', className)}
      >
        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div className="h-12 w-full bg-[#242424] border-b border-white/5 flex items-center justify-between px-4 z-[120] shadow-xl shrink-0">
          {/* Page indicator */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
            <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Page</span>
            <input
              type="text"
              value={currentPage}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= numPages) scrollToPage(v);
              }}
              className="bg-black/40 border border-white/10 rounded text-[10px] w-8 text-center text-white font-bold h-6 outline-none focus:border-primary/50"
            />
            <span className="text-[10px] text-white/40 font-black">/ {numPages || '…'}</span>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/5">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1.5 hover:bg-white/10 rounded-md transition-all text-white/70 hover:text-white"><ZoomOut size={16}/></button>
            <span className="text-[10px] text-white/70 font-black min-w-[40px] text-center tracking-tighter">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}  className="p-1.5 hover:bg-white/10 rounded-md transition-all text-white/70 hover:text-white"><ZoomIn  size={16}/></button>
          </div>

          {/* Rotate + download */}
          <div className="flex items-center gap-2">
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all"><RotateCw size={18}/></button>
            <div className="h-6 w-px bg-white/10"/>
            <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all"><Download size={18}/></button>
          </div>
        </div>

        {/* ── Scroll area: all pages stacked ───────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#525659]"
        >
          <Document
            file={url}
            className="flex flex-col gap-12 items-center w-full py-8"
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              pageRefs.current = new Array(n).fill(null);
            }}
            loading={
              <div className="flex flex-col items-center gap-4 py-32">
                <div className="w-12 h-12 border-4 border-white/10 border-t-primary rounded-full animate-spin"/>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Initializing Engine…</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center gap-4 py-32 text-destructive">
                <AlertCircle size={48} strokeWidth={1}/>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Load Interrupted: File Inaccessible</p>
              </div>
            }
          >
            {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
                className="relative shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] bg-white"
                style={{ width: pageWidth || undefined }}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth || undefined}
                  rotate={rotation}
                  loading={
                    <div
                      style={{ width: pageWidth, height: pageWidth * 1.414 }}
                      className="bg-white flex items-center justify-center"
                    >
                      <Loader2 className="animate-spin text-muted/20" size={32}/>
                    </div>
                  }
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                />

                {/* Per-page annotation overlay */}
                <AnnotationPageOverlay
                  annotations={annotations}
                  onSave={onSaveAnnotations || (() => {})}
                  pageNumber={pageNum}
                  containerRef={{ current: pageRefs.current[pageNum - 1] }}
                  isReadOnly={role === 'viewer'}
                />
              </div>
            ))}
          </Document>
        </div>

        {/* ── Sidebar (uses shared context, no overlay of its own) ──── */}
        <AnnotationSystem
          annotations={annotations}
          onSave={onSaveAnnotations || (() => {})}
          containerRef={{ current: null }}   // dummy — sidebar-only in context mode
          mediaType="pdf"
          userRole={role}
          currentPage={currentPage}
          onPageChange={scrollToPage}
        />
      </div>

      <AnnotationAutoScroller 
        annotations={annotations} 
        scrollRef={scrollRef} 
        pageRefs={pageRefs} 
      />

      <style>{`
        .react-pdf__Page__canvas { margin: 0 auto; display: block !important; }
        .react-pdf__Page__textLayer,
        .react-pdf__Page__annotations { display: block !important; z-index: 5; }
        .react-pdf__Page__textLayer { opacity: 0.15; mix-blend-mode: multiply; }
        .custom-scrollbar::-webkit-scrollbar { width: 14px; height: 14px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #323639; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #525659; border: 4px solid #323639; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #606468; }
      `}</style>
    </AnnotationProvider>
  );
};

/** Tiny bridge: registers the scrollToPage fn into AnnotationContext once mounted */
const ScrollToPageBridge: React.FC<{ scrollToPage: (page: number) => void }> = ({ scrollToPage }) => {
  const { setScrollToPage } = useAnnotationContext();
  useEffect(() => {
    setScrollToPage(() => scrollToPage);
    return () => setScrollToPage(undefined);
  }, [scrollToPage, setScrollToPage]);
  return null;
};

/** Listens for activeAnnotationId changes and scrolls the PDF to that specific position */
const AnnotationAutoScroller: React.FC<{
  annotations: Annotation[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  pageRefs: React.RefObject<(HTMLDivElement | null)[]>;
}> = ({ annotations, scrollRef, pageRefs }) => {
  const { activeAnnotationId } = useAnnotationContext();

  useEffect(() => {
    if (!activeAnnotationId || !scrollRef.current) return;
    
    const anno = annotations.find(a => a.id === activeAnnotationId);
    if (!anno || !anno.pageNumber) return;

    const pageEl = pageRefs.current[anno.pageNumber - 1];
    if (!pageEl) return;

    // Calculate the absolute top position of the annotation relative to the scroll container
    // pageEl.offsetTop gives us the distance from the top of the Document wrapper
    const container = scrollRef.current;
    const pageTop = pageEl.offsetTop;
    const pageHeight = pageEl.offsetHeight;
    
    // anno.y is a percentage (0-100)
    const annoYPixels = (anno.y / 100) * pageHeight;
    
    // We want the annotation to be centered in the viewport
    const targetScroll = pageTop + annoYPixels - container.offsetHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }, [activeAnnotationId, annotations, scrollRef, pageRefs]);

  return null;
};
