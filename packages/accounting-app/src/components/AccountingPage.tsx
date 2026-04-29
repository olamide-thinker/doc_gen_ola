import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSyncedStore } from "@syncedstore/react";
import {
  ArrowLeft,
  Receipt as ReceiptIcon,
  FileText,
  Calculator,
  Filter,
  Sparkles,
  Boxes,
  User as UserIcon,
  Briefcase,
  Info as AlertCircle,
  CheckCircle2,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { uiStore } from "../store";

// ── Helpers ──────────────────────────────────────────────────────────────

const fmtNaira = (n: number): string => {
  if (!Number.isFinite(n)) return "₦0";
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    const decimals = Math.abs(v) >= 100 ? 0 : 1;
    return `₦${v.toFixed(decimals).replace(/\.0$/, "")}k`;
  }
  return `₦${Math.round(n).toLocaleString()}`;
};

const fmtFull = (n: number): string =>
  Number.isFinite(n) ? `₦${Math.round(n).toLocaleString()}` : "₦0";

const COLOR_TINT: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  amber: "bg-amber-500/10 text-amber-600",
  red: "bg-red-500/10 text-red-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  sky: "bg-sky-500/10 text-sky-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
};

const TASK_STATUS_TINT: Record<string, string> = {
  pending: "bg-red-500/10 text-red-500",
  progress: "bg-amber-500/10 text-amber-500",
  done: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
};

// ── Page ─────────────────────────────────────────────────────────────────

const AccountingPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, user } = useAuth();
  const ui = useSyncedStore(uiStore);
  const search = ui.settings.searchQuery || "";

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["accounting", projectId],
    queryFn: () => api.getProjectAccounting(projectId!),
    enabled: !!projectId && !!user,
  });

  const filteredTransactions = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.transactions.filter((t) => {
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        (t.invoiceName || "").toLowerCase().includes(q) ||
        (t.invoiceCode || "").toLowerCase().includes(q) ||
        (t.taskCode || "").toLowerCase().includes(q) ||
        (t.taskTitle || "").toLowerCase().includes(q) ||
        (t.counterpartyName || "").toLowerCase().includes(q) ||
        (t.categoryName || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, categoryFilter]);

  // Distinct categories used across the transactions, for the filter chips.
  const categoryOptions = useMemo(() => {
    if (!data) return [] as Array<{ id: string; name: string; color: string | null; count: number }>;
    const map = new Map<string, { id: string; name: string; color: string | null; count: number }>();
    for (const t of data.transactions) {
      if (!t.categoryId) continue;
      const existing = map.get(t.categoryId);
      if (existing) existing.count += 1;
      else
        map.set(t.categoryId, {
          id: t.categoryId,
          name: t.categoryName || "—",
          color: t.categoryColor,
          count: 1,
        });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (!projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <AlertCircle size={32} className="text-current" />
        <p className="text-[11px] font-bold uppercase tracking-widest mt-3">No active project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Sub-header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} className="text-current" />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">
              Accounting
            </h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              Transaction log · {data?.project?.name || "Project"}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading || !data ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/60 text-[11px] font-bold uppercase tracking-widest">
            Loading transactions…
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-8 space-y-5">
            {/* Project ribbon */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-primary/10 text-primary rounded-md">
                <FileText size={11} className="text-current" /> Project
              </span>
              <h2 className="text-base font-black truncate">{data.project.name}</h2>
            </div>

            {/* Three-card summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryCard
                label="Total Budget"
                amountFull={fmtFull(data.totalBudget)}
                amountCompact={fmtNaira(data.totalBudget)}
              />
              <SummaryCard
                label="Total Spent"
                amountFull={fmtFull(data.totalSpent)}
                amountCompact={fmtNaira(data.totalSpent)}
              />
              <SummaryCard
                label="Total Saved"
                amountFull={fmtFull(data.totalSaved)}
                amountCompact={fmtNaira(data.totalSaved)}
                tone={
                  data.totalSaved > 0
                    ? "positive"
                    : data.totalSaved < 0
                      ? "negative"
                      : "neutral"
                }
              />
            </div>

            {/* Category filter strip */}
            {categoryOptions.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <Filter size={12} className="text-muted-foreground/60 text-current shrink-0" />
                <FilterChip
                  active={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                  label="All"
                  count={data.transactionCount}
                />
                {categoryOptions.map((c) => (
                  <FilterChip
                    key={c.id}
                    active={categoryFilter === c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    label={c.name}
                    count={c.count}
                    colorKey={c.color || undefined}
                  />
                ))}
              </div>
            )}

            {/* Transactions */}
            {data.transactions.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl px-6 py-16 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <ReceiptIcon size={22} className="text-muted-foreground/60 text-current" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-1">
                  No transactions yet
                </h3>
                <p className="text-[10px] font-medium text-muted-foreground/70 leading-relaxed max-w-md mx-auto">
                  Finalise a receipt on any project invoice and it appears here. Tag invoices with a Resource Category and Counterparty for the richer breakdown.
                </p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl px-6 py-16 text-center">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-1">
                  No matches
                </h3>
                <p className="text-[10px] font-medium text-muted-foreground/70">
                  Try a different filter or clear the search.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                <div className="px-5 py-3 bg-muted/20 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-1.5">
                    <Calculator size={11} className="text-current" />
                    Transaction Log
                  </h3>
                  <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums">
                    {filteredTransactions.length} of {data.transactionCount}
                  </span>
                </div>
                {filteredTransactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onClick={() => navigate(`/invoice/${t.invoiceId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

const SummaryCard: React.FC<{
  label: string;
  amountFull: string;
  amountCompact: string;
  tone?: "neutral" | "positive" | "negative";
}> = ({ label, amountFull, amountCompact, tone = "neutral" }) => {
  const toneCls = {
    neutral: "bg-card border-border",
    positive: "bg-emerald-500/5 border-emerald-500/20",
    negative: "bg-red-500/5 border-red-500/30",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-5 transition-colors", toneCls)}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {label}
      </div>
      <div className="text-2xl font-black tabular-nums leading-none" title={amountFull}>
        {amountCompact}
      </div>
    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  colorKey?: string;
}> = ({ active, onClick, label, count, colorKey }) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-foreground/30",
    )}
  >
    {colorKey && (
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          {
            blue: "bg-blue-500",
            amber: "bg-amber-500",
            red: "bg-red-500",
            emerald: "bg-emerald-500",
            violet: "bg-violet-500",
            sky: "bg-sky-500",
            rose: "bg-rose-500",
            slate: "bg-slate-500",
          }[colorKey] || "bg-slate-500",
        )}
      />
    )}
    {label}
    <span
      className={cn(
        "text-[9px] font-mono px-1 rounded-full tabular-nums",
        active ? "bg-background/20" : "bg-muted",
      )}
    >
      {count}
    </span>
  </button>
);

const TransactionRow: React.FC<{
  transaction: any;
  onClick: () => void;
}> = ({ transaction: t, onClick }) => {
  const categoryTint = t.categoryColor ? COLOR_TINT[t.categoryColor] : COLOR_TINT.slate;
  const saved = t.invoiceTotal - t.amountPaid;

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1.4fr)_auto] gap-x-5 gap-y-2 px-5 py-4 hover:bg-muted/20 cursor-pointer group transition-colors"
    >
      {/* Column 1: Invoice + task identity */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-black tabular-nums">
            {fmtNaira(t.amountPaid)}
          </span>
          <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded">
            {t.invoiceCode}
          </span>
        </div>
        <div className="mt-1 text-[12px] font-bold leading-snug truncate group-hover:text-primary transition-colors">
          {t.invoiceName}
        </div>
        {t.taskId && (
          <div className="mt-1 inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[8px] font-mono font-black text-muted-foreground/80 px-1.5 py-0.5 bg-muted/40 rounded">
              {t.taskCode}
              {t.taskBudget != null && (
                <span className="opacity-70">· {fmtNaira(t.taskBudget)}</span>
              )}
            </span>
            {t.taskStatus && (
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded",
                  TASK_STATUS_TINT[t.taskStatus] || TASK_STATUS_TINT.pending,
                )}
              >
                {t.taskStatus}
              </span>
            )}
            {t.autoApplied && (
              <span
                className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400"
                title="Linked task's status was auto-applied via an accepted confirmation request"
              >
                <Sparkles size={9} className="text-current" /> After-Auto
              </span>
            )}
          </div>
        )}
      </div>

      {/* Column 2: Category + receipt + counterparty */}
      <div className="min-w-0 space-y-1.5">
        {t.categoryName ? (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded",
              categoryTint,
            )}
          >
            <Boxes size={10} className="text-current" />
            <span className="opacity-70">Resource Category:</span> {t.categoryName}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 italic">
            <Boxes size={10} className="text-current" /> Uncategorised
          </span>
        )}

        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {t.percentPaid > 0 && t.percentPaid < 100 && (
            <span className="text-[10px] font-bold text-amber-600">{t.percentPaid}%</span>
          )}
          {t.percentPaid >= 100 && (
            <CheckCircle2 size={11} className="text-emerald-500 text-current" />
          )}
          {t.receiptUrl ? (
            <a
              href={t.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary font-bold hover:underline truncate"
            >
              <ReceiptIcon size={11} className="text-current" />
              Receipt PDF
            </a>
          ) : (
            <span className="text-muted-foreground/60 font-bold">No PDF</span>
          )}
          {t.counterpartyName && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1 text-foreground/80 font-bold truncate">
                {t.counterpartyKind === "company" || t.counterpartyKind === "vendor" ? (
                  <Briefcase size={11} className="text-current text-muted-foreground/70" />
                ) : (
                  <UserIcon size={11} className="text-current text-muted-foreground/70" />
                )}
                {t.counterpartyName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Column 3: Numbers */}
      <div className="grid grid-cols-3 gap-5 text-right">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5">
            Budget
          </div>
          <div className="text-[12px] font-bold tabular-nums">
            {fmtNaira(t.invoiceTotal)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5">
            Paid
          </div>
          <div className="text-[12px] font-bold tabular-nums text-emerald-600">
            {fmtNaira(t.amountPaid)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5">
            Saved
          </div>
          <div
            className={cn(
              "text-[12px] font-bold tabular-nums",
              saved > 0 ? "text-emerald-600" : saved < 0 ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {saved === 0 ? "00" : fmtNaira(saved)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingPage;
