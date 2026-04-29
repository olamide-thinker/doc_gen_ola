import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  X,
  Plus,
  Search,
  Calculator,
  Receipt as ReceiptIcon,
  FileText,
  Unlink,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  name: string;
  status: string | null;
  templateType: string | null;
  total: number;
  totalPaid: number;
  createdAt: string;
}

interface ReceiptRow {
  id: string;
  invoiceId: string;
  status: string | null;
  amountPaid: number;
  createdAt: string;
  linkedVia: "invoice" | "direct";
}

interface TaskFinancialsTabProps {
  projectId: string;
  taskId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const fmtNaira = (n: number): string => {
  if (!Number.isFinite(n)) return "₦0";
  // Compact for thousands+ to match the "₦2.5k" feel in the design.
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    const decimals = Math.abs(v) >= 100 ? 0 : 1;
    return `₦${v.toFixed(decimals).replace(/\.0$/, "")}k`;
  }
  return `₦${Math.round(n).toLocaleString()}`;
};

const fmtDate = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const TYPE_LABEL: Record<string, string> = {
  boq: "BOQ",
  procurement: "Procurement",
  labour: "Labour",
  mobilization: "Mobilization",
  progress: "Progress",
  variation: "Variation",
  final: "Final",
  retainer: "Retainer",
  reimbursement: "Reimbursement",
  blank: "Invoice",
};

const labelForInvoice = (inv: InvoiceRow): string => {
  if (!inv.templateType) return "Invoice";
  const k = inv.templateType.toLowerCase();
  return TYPE_LABEL[k] || inv.templateType;
};

// ── Main component ───────────────────────────────────────────────────────

export const TaskFinancialsTab: React.FC<TaskFinancialsTabProps> = ({
  projectId,
  taskId,
}) => {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task-financials", taskId],
    queryFn: () => api.getTaskFinancials(taskId),
    enabled: !!taskId,
  });

  const unlinkInvoice = useMutation({
    mutationFn: (invoiceId: string) => api.linkInvoiceToTask(invoiceId, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-financials", taskId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to unlink invoice"),
  });

  const unlinkReceipt = useMutation({
    mutationFn: (receiptId: string) => api.linkReceiptToTask(receiptId, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-financials", taskId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to unlink receipt"),
  });

  if (isLoading || !data) {
    return (
      <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
        Loading financials…
      </div>
    );
  }

  const { totalCost, totalPaid, balance, invoices, receipts } = data;
  const overdrawn = balance < 0;

  return (
    <div className="space-y-5">
      {/* Three-card summary row — mirrors the design mockup. */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard label="Total cost" value={totalCost} tone="neutral" />
        <SummaryCard label="Total paid" value={totalPaid} tone="neutral" />
        <SummaryCard
          label="Balance"
          value={balance}
          tone={overdrawn ? "danger" : balance === 0 ? "ok" : "warn"}
          highlight
        />
      </div>

      {/* Linked invoices */}
      <Section
        icon={FileText}
        title="Linked Invoices"
        count={invoices.length}
        action={
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all"
            title="Link an existing invoice"
          >
            <Plus size={10} className="text-current" /> Link Invoice
          </button>
        }
      >
        {invoices.length === 0 ? (
          <EmptyHint message="No invoices linked to this task yet" />
        ) : (
          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                disabled={unlinkInvoice.isPending}
                onUnlink={() => {
                  if (
                    confirm(
                      `Unlink "${inv.name}" from this task? Any payments cascaded through this invoice will stop counting.`,
                    )
                  ) {
                    unlinkInvoice.mutate(inv.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Linked receipts */}
      {receipts.length > 0 && (
        <Section
          icon={ReceiptIcon}
          title="Payments Received"
          count={receipts.length}
        >
          <div className="space-y-1.5">
            {receipts.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                disabled={unlinkReceipt.isPending}
                onUnlink={
                  r.linkedVia === "direct"
                    ? () => {
                        if (
                          confirm("Unlink this receipt from the task?")
                        ) {
                          unlinkReceipt.mutate(r.id);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </Section>
      )}

      {/* Picker */}
      {pickerOpen && (
        <InvoicePickerOverlay
          projectId={projectId}
          taskId={taskId}
          alreadyLinkedIds={new Set(invoices.map((i) => i.id))}
          onClose={() => setPickerOpen(false)}
          onLinked={() => {
            queryClient.invalidateQueries({
              queryKey: ["task-financials", taskId],
            });
          }}
        />
      )}
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

const SummaryCard: React.FC<{
  label: string;
  value: number;
  tone: "neutral" | "warn" | "danger" | "ok";
  highlight?: boolean;
}> = ({ label, value, tone, highlight }) => {
  const toneCls = {
    neutral: "bg-muted/30 border-border",
    warn: "bg-amber-500/10 border-amber-500/20",
    danger: "bg-red-500/10 border-red-500/30",
    ok: "bg-emerald-500/10 border-emerald-500/20",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-colors",
        toneCls,
        highlight && "ring-1 ring-inset ring-foreground/5",
      )}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
        {label}
      </div>
      <div className="text-lg font-black tabular-nums leading-none">
        {fmtNaira(value)}
      </div>
    </div>
  );
};

const Section: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: Icon, title, count, action, children }) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
        <Icon size={11} className="text-current" />
        {title}
        {typeof count === "number" && (
          <span className="text-muted-foreground/60 font-mono">({count})</span>
        )}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

const EmptyHint: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 italic border border-dashed border-border rounded-lg px-4 py-5 text-center">
    {message}
  </div>
);

const InvoiceCard: React.FC<{
  invoice: InvoiceRow;
  disabled?: boolean;
  onUnlink: () => void;
}> = ({ invoice, disabled, onUnlink }) => {
  const isLocked = invoice.status === "locked";
  const partial = invoice.totalPaid > 0 && invoice.totalPaid < invoice.total;
  const paid = invoice.total > 0 && invoice.totalPaid >= invoice.total;
  return (
    <div className="flex items-center gap-3 p-2.5 bg-muted/20 border border-border/50 rounded-lg group">
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FileText size={14} className="text-current" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {labelForInvoice(invoice)}
          </span>
          <span className="text-[12px] font-bold truncate">{invoice.name}</span>
          {isLocked && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 shrink-0">
              Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
          <span>{fmtNaira(invoice.totalPaid)} / {fmtNaira(invoice.total)} paid</span>
          {paid && <CheckCircle2 size={10} className="text-emerald-500 text-current" />}
          {partial && <Clock size={10} className="text-amber-500 text-current" />}
        </div>
      </div>
      <button
        type="button"
        onClick={onUnlink}
        disabled={disabled}
        title="Unlink from task"
        className="p-1.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
      >
        <Unlink size={12} className="text-current" />
      </button>
    </div>
  );
};

const ReceiptCard: React.FC<{
  receipt: ReceiptRow;
  disabled?: boolean;
  onUnlink?: () => void;
}> = ({ receipt, disabled, onUnlink }) => {
  const finalised = receipt.status === "finalised";
  return (
    <div className="flex items-center gap-3 p-2.5 bg-muted/20 border border-border/50 rounded-lg group">
      <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
        <ReceiptIcon size={14} className="text-current" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-bold tabular-nums">
            {fmtNaira(receipt.amountPaid)}
          </span>
          {finalised ? (
            <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 shrink-0">
              Cleared
            </span>
          ) : (
            <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">
              {receipt.status || "draft"}
            </span>
          )}
          {receipt.linkedVia === "invoice" && (
            <span
              title="Linked through the parent invoice"
              className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0"
            >
              via invoice
            </span>
          )}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
          {fmtDate(receipt.createdAt)}
        </div>
      </div>
      {onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          disabled={disabled}
          title="Unlink from task"
          className="p-1.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
        >
          <Unlink size={12} className="text-current" />
        </button>
      )}
    </div>
  );
};

// ── Picker (overlays the modal) ──────────────────────────────────────────
// Lists project documents that look like invoices (anything not flagged
// as receipt/plan/resource), excluding ones already linked to this task.
// Click to link → invalidates query → modal updates.

const InvoicePickerOverlay: React.FC<{
  projectId: string;
  taskId: string;
  alreadyLinkedIds: Set<string>;
  onClose: () => void;
  onLinked: () => void;
}> = ({ projectId, taskId, alreadyLinkedIds, onClose, onLinked }) => {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => api.getDocuments(projectId),
    enabled: !!projectId,
  });

  const eligible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (docs as any[])
      .filter((d) => {
        const c = d.content || {};
        // Only invoices — skip receipts, plans, and resource docs.
        if (c.isReceipt || c.isPlan || c._isResource) return false;
        // Skip ones already linked to this task.
        if (alreadyLinkedIds.has(d.id)) return false;
        // Skip ones linked to a different task — keep the picker focused
        // on documents that are free to claim. Re-linking is a separate
        // flow; we don't quietly steal links from other tasks.
        const otherTaskId = (d.metadata?.taskId || d.content?.metadata?.taskId) as string | undefined;
        if (otherTaskId && otherTaskId !== taskId) return false;
        if (!q) return true;
        return (
          (d.name || "").toLowerCase().includes(q) ||
          (d.id || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [docs, search, alreadyLinkedIds, taskId]);

  const link = async (id: string) => {
    setBusyId(id);
    try {
      await api.linkInvoiceToTask(id, taskId);
      onLinked();
    } catch (e: any) {
      alert(e?.message || "Failed to link");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[70vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Link Invoice</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Pick an existing project invoice
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Close">
            <X size={16} className="text-current" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices by name…"
              className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-[12px] font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-border focus:bg-background transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
              Loading…
            </div>
          ) : eligible.length === 0 ? (
            <EmptyHint
              message={
                docs.length === 0
                  ? "No invoices in this project yet"
                  : "No more invoices available to link"
              }
            />
          ) : (
            <div className="space-y-1.5">
              {eligible.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => link(d.id)}
                  disabled={busyId === d.id}
                  className="w-full flex items-center gap-3 p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-primary/30 rounded-lg transition-all text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{d.name}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/70 truncate">
                      {fmtDate(d.updatedAt || d.createdAt)}
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary inline-flex items-center gap-1 shrink-0">
                    <LinkIcon size={11} className="text-current" />
                    {busyId === d.id ? "…" : "Link"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 bg-muted/10 flex items-center justify-between gap-2">
          <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1.5">
            <Calculator size={10} className="text-current" />
            Linked invoices cascade their payments to the task
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
