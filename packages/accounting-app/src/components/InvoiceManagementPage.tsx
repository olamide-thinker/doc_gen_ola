import React, { useState, useMemo } from "react";
import { API_BASE } from "../lib/workspace-persist";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Shield,
  Trash2,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  Ban,
  MoreVertical,
  History,
  Info,
  Eye,
  RotateCw,
  X
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { formatDate, computeTotalPrice, resolveFormula, resolveSectionTotal, resolveSectionTotalBackward, calculateChunks, getRowNumbering } from "../lib/documentUtils";
import { InvoicePage } from "./InvoicePage";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Worker setup — mirrors PdfViewer.tsx so react-pdf works on this page even if
// PdfViewer hasn't been mounted yet during this session.
const CDN_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
} catch {
  pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
}

// Convert a possibly-relative pdfUrl from doc metadata into an absolute URL.
const resolvePdfUrl = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (/^https?:/i.test(raw)) return raw;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}/${String(raw).replace(/^\//, '')}`;
};

const InvoiceManagementPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromFolder = (location.state as any)?.fromFolder as string | undefined;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Back goes to the folder the user came from (preserved in router state),
  // or falls back to the dashboard root.
  const handleBack = () => {
    if (fromFolder) navigate(`/dashboard?folder=${fromFolder}`);
    else navigate('/dashboard');
  };

  const { data: invoiceResult, isLoading } = useQuery({
    queryKey: ['invoice-management', id],
    queryFn: () => api.getInvoiceManagement(id!),
    enabled: !!id
  });

  // The invoice's WorkspaceDocument — needed for metadata.pdfUrl when finalised
  const { data: invoiceDoc } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  const invoicePdfUrl = useMemo(
    () => resolvePdfUrl((invoiceDoc as any)?.metadata?.pdfUrl),
    [invoiceDoc],
  );


  // No versions anymore, simplified state


  const createReceiptMutation = useMutation({
    mutationFn: () => api.createReceipt(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
      navigate(`/receipt-editor/${result.id}`);
    },
    onError: (err: any) => {
      alert(`Failed to create receipt: ${err.message || err}`);
    }
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (rid: string) => api.deleteReceipt(rid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
    },
    onError: (err: any) => {
      alert(`Failed to delete receipt: ${err.message || err}`);
    }
  });

  if (isLoading || !invoiceResult) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { 
    grandTotal, 
    totalPaid, 
    outstanding, 
    status, 
    name, 
    draft, 
    receipts = [],
    chain = []
  } = invoiceResult;

  return (
    <div className="min-h-screen bg-muted/20 font-lexend text-foreground flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center px-8 shrink-0 sticky top-0 z-20">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mr-4"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-black uppercase tracking-widest truncate">{name || "Untitled Invoice"}</h1>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
              status === 'active' ? "bg-success/10 text-success" : 
              status === 'voided' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}>
              {status}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
            ID: {id} • {receipts.length} receipts
          </p>
        </div>
        <div className="flex items-center gap-3">
           <button
            onClick={() => navigate(`/editor/${id}`)}
            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all text-[10px] font-bold uppercase tracking-widest border border-border"
          >
            Open Editor
          </button>
          {status === 'locked' && (
            <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-warning/20">
              <Shield size={14} /> Read Only
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col gap-8 pb-20">

        {/* Invoice Preview + Stats */}
        <section className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-6">
          <PdfThumbnail
            url={invoicePdfUrl}
            width={160}
            emptyText={status === 'locked' ? 'PDF pending' : 'Not finalised'}
            onClick={() => navigate(`/editor/${id}`)}
            hoverLabel="Open"
          />

          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Invoice Preview</h2>
                <p className="text-sm font-bold text-foreground truncate">{name || 'Untitled Invoice'}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-black",
                    status === 'active' ? 'bg-success/10 text-success' :
                    status === 'voided' ? 'bg-destructive/10 text-destructive' :
                    'bg-primary/10 text-primary'
                  )}>
                    {status}
                  </span>
                  {invoiceDoc?.createdAt && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> Created {formatDate(invoiceDoc.createdAt)}
                      </span>
                    </>
                  )}
                  {invoiceDoc?.updatedAt && invoiceDoc.updatedAt !== invoiceDoc.createdAt && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <RotateCw size={10} /> Updated {formatDate(invoiceDoc.updatedAt)}
                      </span>
                    </>
                  )}
                  {id && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="font-mono text-muted-foreground/70">ID {id.slice(0, 8)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => navigate(`/editor/${id}`)}
                  className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-all border border-border"
                  title="Open Editor"
                >
                  <Eye size={13} />
                </button>
                {invoicePdfUrl && (
                  <a
                    href={invoicePdfUrl}
                    download={`${name || 'invoice'}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-all border border-border inline-flex items-center justify-center"
                    title="Download finalised PDF"
                  >
                    <Download size={13} />
                  </a>
                )}
              </div>
            </div>

            {/* Compact stats — same info as the old cards, denser layout */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Summary</h3>
              <div className="grid grid-cols-3 gap-3">
              <div className="px-3 py-2.5 rounded-lg bg-muted/40 border border-border/60 relative overflow-hidden group">
                <div className="absolute -top-2 -right-2 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity text-foreground pointer-events-none">
                  <FileText size={56} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Total Amount</span>
                <div className="text-lg font-black tabular-nums leading-none flex items-baseline gap-0.5">
                  <span className="text-muted-foreground font-medium text-xs">&#8358;</span>{Math.round(grandTotal).toLocaleString()}
                </div>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-2 inline-flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded">
                  <Info size={9} /> Expected Total
                </span>
              </div>

              <div className="px-3 py-2.5 rounded-lg bg-success/5 border border-success/20 relative overflow-hidden group">
                <div className="absolute -top-2 -right-2 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity text-success pointer-events-none">
                  <CheckCircle2 size={56} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Total Received</span>
                <div className="text-lg font-black text-success tabular-nums leading-none flex items-baseline gap-0.5">
                  <span className="text-success/60 font-medium text-xs">&#8358;</span>{Math.round(totalPaid).toLocaleString()}
                </div>
                <span className="text-[8px] font-bold text-success uppercase tracking-widest mt-2 inline-flex items-center gap-1 bg-success/10 px-1.5 py-0.5 rounded tabular-nums">
                  {receipts.length} Finalised Receipt{receipts.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className={cn(
                "px-3 py-2.5 rounded-lg border relative overflow-hidden group",
                outstanding > 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20"
              )}>
                <div className={cn(
                  "absolute -top-2 -right-2 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity pointer-events-none",
                  outstanding > 0 ? "text-warning" : "text-success"
                )}>
                  <Clock size={56} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Outstanding</span>
                <div className={cn("text-lg font-black tabular-nums leading-none flex items-baseline gap-0.5", outstanding > 0 ? "text-warning" : "text-success")}>
                  <span className={cn("font-medium text-xs", outstanding > 0 ? "text-warning/60" : "text-success/60")}>&#8358;</span>{Math.round(outstanding).toLocaleString()}
                </div>
                {outstanding > 0 ? (
                  <span className="text-[8px] font-bold text-warning uppercase tracking-widest mt-2 inline-flex items-center gap-1 bg-warning/10 px-1.5 py-0.5 rounded">
                    <Ban size={9} /> Pending Balance
                  </span>
                ) : (
                  <span className="text-[8px] font-bold text-success uppercase tracking-widest mt-2 inline-flex items-center gap-1 bg-success/10 px-1.5 py-0.5 rounded">
                    <CheckCircle2 size={9} /> Fully Settled
                  </span>
                )}
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* Receipts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText size={16} /> Linked Receipts
            </h2>
            <button
              onClick={() => createReceiptMutation.mutate()}
              disabled={createReceiptMutation.isPending}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> {createReceiptMutation.isPending ? 'Creating...' : 'New Receipt'}
            </button>
          </div>
          
          {/* Active Drafts Section */}
          {receipts.some((r: any) => r.status === 'draft') && (
            <div className="mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Clock size={12} /> Live Drafts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {receipts
                  .filter((r: any) => r.status === 'draft')
                  .map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/receipt-editor/${r.id}`)}
                      className="bg-primary/5 border border-primary/20 p-3 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-center gap-3 cursor-pointer relative"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        <Plus size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-black">Draft Receipt</span>
                          <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">In Progress</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                          Updated {formatDate(r.updatedAt)} · <span className="text-primary group-hover:underline underline-offset-4">Continue →</span>
                        </p>
                      </div>
                      <button
                         onClick={(e) => {
                           e.stopPropagation();
                           if (confirm("Are you sure you want to delete this draft receipt?")) {
                             deleteReceiptMutation.mutate(r.id);
                           }
                         }}
                         className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all shrink-0"
                         title="Delete Draft"
                      >
                         <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chain.map((rv: any) => (
              <div key={rv.receiptId} className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex gap-3 p-3">
                  <button
                    onClick={() => navigate(`/receipt-editor/${rv.receiptId}`)}
                    className="w-12 h-12 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0 hover:bg-success/20 hover:scale-105 transition-all"
                    title="Open Receipt"
                  >
                    <FileText size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-black truncate">Receipt {rv.sequence}</span>
                        <span className="shrink-0 text-[8px] font-black bg-success/10 text-success px-1.5 py-0.5 rounded uppercase tracking-widest">#{rv.sequence}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-black text-success tabular-nums">&#8358;{rv.amountPaid.toLocaleString()}</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to void this receipt? This action cannot be undone.")) {
                              try {
                                await api.voidReceipt(rv.receiptId);
                                queryClient.invalidateQueries({ queryKey: ['invoice-management', id] });
                              } catch (err: any) {
                                alert(`Failed to void: ${err.message}`);
                              }
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                          title="Void Receipt"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                      {formatDate(rv.publishedAt)} · {rv.publisherName || "System"}
                    </p>

                    {/* Remaining trail — flat, no inner box */}
                    <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-black text-muted-foreground uppercase tracking-widest shrink-0">Remaining</span>
                      <span className="tabular-nums font-bold flex items-baseline gap-1.5 min-w-0 truncate">
                        <span className="text-muted-foreground/70">&#8358;{rv.remainingBefore.toLocaleString()}</span>
                        <span className="text-muted-foreground/40">→</span>
                        <span className="text-success">&#8358;{rv.remainingAfter.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {chain.length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground opacity-40">
                <FileText size={32} />
                <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]">No finalized receipts</span>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PdfThumbnailProps {
  url: string | null;
  width?: number;
  onClick?: () => void;
  emptyText?: string;
  hoverLabel?: string;
}

/** Renders the first page of a PDF as a small thumbnail card. Shows a
 * placeholder when the URL isn't available yet (e.g. unfinalised). */
const PdfThumbnail: React.FC<PdfThumbnailProps> = ({ url, width = 140, onClick, emptyText = 'Not finalised', hoverLabel = 'View' }) => {
  const height = Math.round(width * 1.414); // A4-ish ratio

  if (!url) {
    return (
      <div
        onClick={onClick}
        style={{ width, height }}
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground/60 text-[8px] font-black uppercase tracking-widest p-2 text-center",
          onClick && "cursor-pointer hover:bg-muted/50 transition-all"
        )}
      >
        <FileText size={Math.max(16, Math.round(width * 0.18))} className="mb-1.5 opacity-60" />
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
        onClick && "cursor-pointer hover:shadow-md transition-all"
      )}
    >
      <Document
        file={url}
        loading={<div className="w-full h-full bg-muted animate-pulse" />}
        error={
          <div className="w-full h-full bg-destructive/5 text-destructive/60 text-[8px] font-black uppercase tracking-widest flex items-center justify-center text-center p-2">
            Failed to load
          </div>
        }
      >
        <Page pageNumber={1} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
      </Document>
      {onClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 group-hover:bg-foreground/15 opacity-0 group-hover:opacity-100 transition-all">
          <div className="px-2 py-1 bg-background/90 backdrop-blur-sm rounded text-[8px] font-black uppercase tracking-widest border border-border shadow-md inline-flex items-center gap-1">
            <Eye size={10} /> {hoverLabel}
          </div>
        </div>
      )}
    </div>
  );
};

/** Thumbnail that fetches a document by id and renders its finalised PDF. */
const DocPdfThumbnail: React.FC<{ docId: string; width?: number; onClick?: () => void; hoverLabel?: string }> = ({ docId, width, onClick, hoverLabel }) => {
  const { data: doc } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => api.getDocument(docId),
    enabled: !!docId,
  });
  const url = useMemo(() => resolvePdfUrl((doc as any)?.metadata?.pdfUrl), [doc]);
  return <PdfThumbnail url={url} width={width} onClick={onClick} hoverLabel={hoverLabel} />;
};

export default InvoiceManagementPage;
