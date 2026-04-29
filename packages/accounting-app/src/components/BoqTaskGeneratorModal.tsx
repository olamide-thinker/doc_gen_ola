import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Plus,
  Check,
  FileText,
  Layers,
  Search,
  Boxes,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import type { TableRow as InvoiceTableRow } from "../types";

interface BoqTaskGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Called after one or more tasks are created so the parent can refetch. */
  onTasksGenerated?: (count: number) => void;
}

interface BoqInvoice {
  id: string;
  name: string;
  status?: string;
  content: any;
  updatedAt?: string;
}

interface BoqItem {
  rowId: string;
  description: string;
  section: string;
  subSection: string | null;
  /** Display number, e.g. "1.2.3", computed for visual reference. */
  numbering: string;
  /** Money or quantity hint pulled from the row's number columns, for display only. */
  amountHint?: string;
}

/**
 * Walk a BOQ's rows, tracking the current section / sub-section as we go,
 * and emit one BoqItem per "item" row (rowType === 'row' or undefined).
 *
 * Section-totals and headers are intentionally skipped — they're structural,
 * not actionable work items.
 */
const flattenBoqRows = (content: any): BoqItem[] => {
  if (!content?.table?.rows) return [];
  const cols: any[] = content.table.columns || [];
  const descColId =
    cols.find((c) => c.type === "text" && /desc|item|task|work/i.test(c.label || ""))?.id ||
    cols.find((c) => c.type === "text")?.id ||
    "B";
  const numCol = cols.find((c) => c.type === "number" || c.type === "formula");

  let section = "Uncategorised";
  let subSection: string | null = null;
  let sectionIdx = 0;
  let subIdx = 0;
  let itemIdx = 0;
  const out: BoqItem[] = [];

  for (const r of content.table.rows as InvoiceTableRow[]) {
    if (r.rowType === "section-header") {
      sectionIdx += 1;
      subIdx = 0;
      itemIdx = 0;
      section = (r.sectionTitle as string) || (r[descColId] as string) || `Section ${sectionIdx}`;
      subSection = null;
      continue;
    }
    if (r.rowType === "sub-section-header") {
      subIdx += 1;
      itemIdx = 0;
      subSection = (r.sectionTitle as string) || (r[descColId] as string) || `Sub-section ${subIdx}`;
      continue;
    }
    if (r.rowType === "section-total") continue;

    const desc = String(r[descColId] || "").trim();
    if (!desc) continue;

    itemIdx += 1;
    const numbering = subSection
      ? `${sectionIdx}.${subIdx}.${itemIdx}`
      : `${sectionIdx}.${itemIdx}`;

    let amountHint: string | undefined;
    if (numCol) {
      const v = r[numCol.id];
      if (typeof v === "number") amountHint = `₦${Math.round(v).toLocaleString()}`;
    }

    out.push({
      rowId: r.id,
      description: desc,
      section,
      subSection,
      numbering,
      amountHint,
    });
  }

  return out;
};

export const BoqTaskGeneratorModal: React.FC<BoqTaskGeneratorModalProps> = ({
  open,
  onClose,
  projectId,
  onTasksGenerated,
}) => {
  const queryClient = useQueryClient();

  // Pull the project's docs and filter to BOQ invoices.
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => api.getDocuments(projectId!),
    enabled: open && !!projectId,
  });

  const boqInvoices: BoqInvoice[] = useMemo(() => {
    // A doc is a BOQ if either (a) the explicit `useSections` flag is on, or
    // (b) the table contains any section-header rows. The fallback catches
    // legacy BOQs created before `useSections` defaulted to true.
    const looksLikeBoq = (content: any): boolean => {
      if (!content || content.isReceipt || content.isPlan || content._isResource) return false;
      if (content.useSections === true) return true;
      const rows: any[] = content?.table?.rows || [];
      return rows.some(
        (r) => r?.rowType === "section-header" || r?.rowType === "sub-section-header",
      );
    };

    return (allDocs as any[])
      .filter(
        (d) =>
          looksLikeBoq(d.content) &&
          // Default: any BOQ-shaped invoice is task-source eligible UNLESS the
          // owner explicitly opted out (boqTaskSource === false). undefined or
          // true both qualify, so legacy BOQs still appear without migration.
          d.content?.boqTaskSource !== false &&
          // At least partially paid — `receiptCount` is computed by the
          // workspaces endpoint from invoice.receipts (finalised only).
          ((d as any).receiptCount || 0) > 0,
      )
      .map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        content: d.content,
        updatedAt: d.updatedAt,
      }));
  }, [allDocs]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [addedRowIds, setAddedRowIds] = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState(0);

  // Reset on open / project change
  useEffect(() => {
    if (!open) return;
    setAddedRowIds(new Set());
    setAddedCount(0);
    setSearch("");
  }, [open, projectId]);

  // Default-select the most recently updated BOQ when the list arrives
  useEffect(() => {
    if (!open) return;
    if (selectedId && boqInvoices.find((b) => b.id === selectedId)) return;
    if (boqInvoices.length > 0) setSelectedId(boqInvoices[0].id);
  }, [open, boqInvoices, selectedId]);

  const selected = useMemo(
    () => boqInvoices.find((b) => b.id === selectedId) || null,
    [boqInvoices, selectedId],
  );

  const items = useMemo(() => (selected ? flattenBoqRows(selected.content) : []), [selected]);

  // Precompute item counts once per BOQ list change so we can render counts in
  // the left rail without calling a hook inside a .map() callback.
  const itemCountById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of boqInvoices) m[b.id] = flattenBoqRows(b.content).length;
    return m;
  }, [boqInvoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.description.toLowerCase().includes(q) ||
        i.section.toLowerCase().includes(q) ||
        (i.subSection && i.subSection.toLowerCase().includes(q)),
    );
  }, [items, search]);

  // Group flattened items back by section/sub-section for display
  const grouped = useMemo(() => {
    const out: Array<{ section: string; subSection: string | null; rows: BoqItem[] }> = [];
    for (const item of filtered) {
      const last = out[out.length - 1];
      if (!last || last.section !== item.section || last.subSection !== item.subSection) {
        out.push({ section: item.section, subSection: item.subSection, rows: [item] });
      } else {
        last.rows.push(item);
      }
    }
    return out;
  }, [filtered]);

  const handleAdd = async (row: BoqItem) => {
    if (!selected) return;
    setBusyRowId(row.rowId);
    try {
      const detailsLines = [
        `From BOQ: ${selected.name}`,
        `Section: ${row.section}`,
        row.subSection ? `Sub-section: ${row.subSection}` : null,
        `Item: ${row.numbering}`,
        row.amountHint ? `Reference amount: ${row.amountHint}` : null,
      ].filter(Boolean);

      await api.createTask({
        projectId,
        title: row.description,
        details: detailsLines.join("\n"),
        priority: "med",
        status: "pending",
        metadata: {
          source: "boq",
          boqInvoiceId: selected.id,
          boqInvoiceName: selected.name,
          boqRowId: row.rowId,
          boqSection: row.section,
          boqSubSection: row.subSection,
          boqNumbering: row.numbering,
        },
      });
      setAddedRowIds((s) => new Set(s).add(row.rowId));
      setAddedCount((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch (e: any) {
      alert(e?.message || "Failed to create task");
    } finally {
      setBusyRowId(null);
    }
  };

  const handleClose = () => {
    if (addedCount > 0) onTasksGenerated?.(addedCount);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">Generate Tasks from BOQ</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Pick a BOQ on the left, then add its line items as tasks {addedCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-success/15 text-success rounded">
                      {addedCount} added
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                title="Close"
              >
                <X size={16} className="text-current" />
              </button>
            </div>

            {/* Body — two columns */}
            <div className="flex-1 grid grid-cols-[280px_1fr] divide-x divide-border min-h-0">
              {/* Left: BOQ list */}
              <aside className="flex flex-col bg-muted/10 min-h-0">
                <div className="px-4 py-3 border-b border-border shrink-0">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    BOQs in project
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">
                    {boqInvoices.length} available
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                  {boqInvoices.length === 0 ? (
                    <div className="py-12 text-center px-4">
                      <Boxes size={28} className="mx-auto mb-2 text-muted-foreground/40 text-current" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        No eligible BOQs
                      </p>
                      <p className="text-[9px] text-muted-foreground/40 mt-1.5 leading-relaxed">
                        A sectioned BOQ shows up here once it has at least one finalised receipt against it. (You can hide a specific BOQ by turning off <b>Use as Task Source</b> in the invoice editor.)
                      </p>
                    </div>
                  ) : (
                    boqInvoices.map((b) => {
                      const isSelected = selectedId === b.id;
                      const itemCount = itemCountById[b.id] || 0;
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-2.5 border",
                            isSelected
                              ? "bg-primary/10 border-primary/30 shadow-sm"
                              : "bg-card border-border hover:bg-muted/40",
                          )}
                        >
                          <div
                            className={cn(
                              "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                              isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <FileText size={13} className="text-current" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold leading-snug line-clamp-2">{b.name}</p>
                            <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-0.5">
                              {itemCount} item{itemCount === 1 ? "" : "s"}
                              {b.status && b.status !== "active" ? ` · ${b.status}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* Right: Items in selected BOQ */}
              <section className="flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex-1 truncate">
                    {selected ? `Items · ${selected.name}` : "Select a BOQ"}
                  </h3>
                  {selected && (
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter items, sections..."
                        className="w-56 pl-7 pr-3 py-1.5 bg-muted/40 border border-transparent rounded-lg text-[11px] font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-border focus:bg-background transition-all"
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {!selected ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/40 py-20">
                      <FileText size={32} className="mb-2 text-current" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        Pick a BOQ on the left
                      </p>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/40 py-20">
                      <Layers size={32} className="mb-2 text-current" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        This BOQ has no line items
                      </p>
                    </div>
                  ) : grouped.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/40 py-20">
                      <Search size={32} className="mb-2 text-current" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No matches</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {grouped.map((group, gi) => (
                        <div key={gi}>
                          <div className="flex items-baseline gap-2 mb-2 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground">
                              {group.section}
                            </h4>
                            {group.subSection && (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                · {group.subSection}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {group.rows.map((row) => {
                              const added = addedRowIds.has(row.rowId);
                              const busy = busyRowId === row.rowId;
                              return (
                                <div
                                  key={row.rowId}
                                  className={cn(
                                    "flex items-start gap-3 p-2.5 rounded-lg border transition-all",
                                    added
                                      ? "bg-success/5 border-success/30"
                                      : "bg-muted/20 border-transparent hover:bg-muted/40 hover:border-border",
                                  )}
                                >
                                  <span className="shrink-0 mt-0.5 text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/60 rounded tabular-nums">
                                    {row.numbering}
                                  </span>
                                  <p className="flex-1 text-[11px] leading-snug line-clamp-2">
                                    {row.description}
                                  </p>
                                  {row.amountHint && (
                                    <span className="shrink-0 text-[9px] font-mono font-bold text-muted-foreground/70 mt-0.5 tabular-nums">
                                      {row.amountHint}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleAdd(row)}
                                    disabled={busy}
                                    className={cn(
                                      "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                                      added
                                        ? "bg-success text-success-foreground"
                                        : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
                                    )}
                                  >
                                    {added ? (
                                      <>
                                        <Check size={11} className="text-current" /> Added
                                      </>
                                    ) : busy ? (
                                      "Adding..."
                                    ) : (
                                      <>
                                        <Plus size={11} className="text-current" /> Add
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border shrink-0 bg-muted/10">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
