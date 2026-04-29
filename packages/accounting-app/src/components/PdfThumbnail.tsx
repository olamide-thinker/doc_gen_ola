import React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { FileText, Eye } from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { API_BASE } from "../lib/workspace-persist";

// Worker setup — mirrors PdfViewer.tsx so any consumer of this component can
// render a thumbnail without depending on PdfViewer being mounted first.
const CDN_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
} catch {
  pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
}

/**
 * Convert a possibly-relative pdfUrl from doc metadata into an absolute URL
 * that the browser can fetch directly. Handles both already-absolute URLs and
 * paths relative to the API origin.
 */
export const resolvePdfUrl = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (/^https?:/i.test(raw)) return raw;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}/${String(raw).replace(/^\//, "")}`;
};

export interface PdfThumbnailProps {
  url: string | null;
  width?: number;
  /** Override aspect ratio. Defaults to A4 portrait. */
  aspect?: number;
  onClick?: () => void;
  /** Text shown when no PDF is available yet (e.g. unfinalised). */
  emptyText?: string;
  /** Hover label shown over the thumbnail when it's clickable. */
  hoverLabel?: string;
  /** Additional classes on the outer wrapper. */
  className?: string;
  /** Render this overlay on top of the rendered PDF (e.g. a brand icon). */
  overlay?: React.ReactNode;
  /** Render this when the PDF fails to load (instead of the default error block). */
  errorFallback?: React.ReactNode;
}

/**
 * Renders the first page of a PDF as a thumbnail card. Shows a graceful
 * placeholder when no URL is provided, and an error block on load failure.
 *
 * Used by the Invoice Management preview, the receipts chain, and the
 * Dashboard plan cards.
 */
export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
  url,
  width = 140,
  aspect = 1.414,
  onClick,
  emptyText = "Not finalised",
  hoverLabel = "View",
  className,
  overlay,
  errorFallback,
}) => {
  const height = Math.round(width * aspect);

  if (!url) {
    return (
      <div
        onClick={onClick}
        style={{ width, height }}
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground/60 text-[8px] font-black uppercase tracking-widest p-2 text-center",
          onClick && "cursor-pointer hover:bg-muted/50 transition-all",
          className,
        )}
      >
        <FileText size={Math.max(16, Math.round(width * 0.18))} className="mb-1.5 opacity-60 text-current" />
        {emptyText}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{ width, height }}
      className={cn(
        "rounded-lg overflow-hidden border border-border bg-white shadow-sm relative group",
        onClick && "cursor-pointer hover:shadow-md transition-all",
        className,
      )}
    >
      <Document
        file={url}
        loading={<div className="w-full h-full bg-muted animate-pulse" />}
        error={
          errorFallback ?? (
            <div className="w-full h-full bg-destructive/5 text-destructive/60 text-[8px] font-black uppercase tracking-widest flex items-center justify-center text-center p-2">
              Failed to load
            </div>
          )
        }
      >
        <Page pageNumber={1} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
      </Document>

      {overlay}

      {onClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 group-hover:bg-foreground/15 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
          <div className="px-2 py-1 bg-background/90 backdrop-blur-sm rounded text-[8px] font-black uppercase tracking-widest border border-border shadow-md inline-flex items-center gap-1">
            <Eye size={10} className="text-current" /> {hoverLabel}
          </div>
        </div>
      )}
    </div>
  );
};
