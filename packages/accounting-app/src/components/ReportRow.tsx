import React from "react";
import {
  ScrollText,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Ban,
  Clock,
  ChevronRight,
  Trash2,
  MessageSquare,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";

// ── Shared kind metadata ─────────────────────────────────────────────────
// Extracted so ReportsPage and the task modal's Reports tab render rows
// identically without duplicating the badge/icon/tint logic.

export type ReportKind = "note" | "incident" | "update" | "confirmation_request";

export const KIND_META: Record<
  ReportKind,
  { label: string; icon: React.ComponentType<any>; tint: string }
> = {
  note: { label: "Note", icon: ScrollText, tint: "bg-blue-500/10 text-blue-500" },
  incident: { label: "Incident", icon: AlertTriangle, tint: "bg-red-500/10 text-red-500" },
  update: { label: "Update", icon: Sparkles, tint: "bg-amber-500/10 text-amber-500" },
  confirmation_request: {
    label: "Request",
    icon: CheckCircle2,
    tint: "bg-emerald-500/10 text-emerald-600",
  },
};

const RESOLUTION_TINT: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  accepted: "bg-emerald-500/10 text-emerald-600",
  declined: "bg-red-500/10 text-red-500",
};

export const fmtRelative = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) {
    const hrs = Math.floor(diffMs / 3_600_000);
    if (hrs < 1) return "just now";
    return `${hrs}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

// ── Row ──────────────────────────────────────────────────────────────────

export interface ReportRowProps {
  report: any;
  /**
   * The full project tasks list — used to resolve `report.taskId` to a
   * code+title for the "Ref:" badge. We pass it in (rather than refetch)
   * so the row stays cheap to render in lists.
   */
  tasks?: Array<{ id: string; taskCode: string; title: string }>;
  /**
   * When set, hides the "Ref:" badge. The task modal's Reports tab uses
   * this since every row there is by definition about the same task.
   */
  hideTaskRef?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  /**
   * Compact density for tighter surfaces (tab in modal). Defaults to the
   * roomy dashboard layout.
   */
  compact?: boolean;
}

export const ReportRow: React.FC<ReportRowProps> = ({
  report,
  tasks = [],
  hideTaskRef,
  onClick,
  onDelete,
  compact,
}) => {
  const meta = KIND_META[report.kind as ReportKind] || KIND_META.note;
  const Icon = meta.icon;
  const task = !hideTaskRef ? tasks.find((t) => t.id === report.taskId) : null;
  const resolution = report.resolution?.status as string | undefined;
  const isPendingRequest =
    report.kind === "confirmation_request" && !resolution;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 rounded-2xl transition-all cursor-pointer",
        compact ? "p-3" : "p-4 gap-4",
      )}
    >
      <div
        className={cn(
          "rounded-xl flex items-center justify-center shrink-0 border border-border/50",
          meta.tint,
          compact ? "w-8 h-8" : "w-10 h-10",
        )}
      >
        <Icon size={compact ? 13 : 16} className="text-current" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded shrink-0">
            {report.reportCode}
          </span>
          <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0", meta.tint)}>
            {meta.label}
          </span>
          {task && (
            <span className="text-[8px] font-mono font-black text-muted-foreground/70 px-1 py-0.5 bg-muted/40 rounded shrink-0 inline-flex items-center gap-1">
              <span className="opacity-60">Ref:</span> {task.taskCode}
            </span>
          )}
          {report.kind === "confirmation_request" && (
            <span
              className={cn(
                "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                RESOLUTION_TINT[resolution || "pending"],
              )}
            >
              {resolution === "accepted" ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={9} className="text-current" /> Accepted
                </span>
              ) : resolution === "declined" ? (
                <span className="inline-flex items-center gap-1">
                  <Ban size={9} className="text-current" /> Declined
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock size={9} className="text-current" /> Awaiting
                </span>
              )}
            </span>
          )}
        </div>
        <h4
          className={cn(
            "font-bold truncate group-hover:text-primary transition-colors mb-1",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {report.title || (report.body || "").split("\n")[0] || "Untitled report"}
        </h4>
        <p
          className={cn(
            "text-muted-foreground line-clamp-2 leading-relaxed",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {report.body}
        </p>
        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          <span className="truncate max-w-[140px]">
            {report.author?.fullName || report.author?.email || report.authorId || "Unknown"}
          </span>
          <span>•</span>
          <span>{fmtRelative(report.createdAt)}</span>
          {(report.replyCount || 0) > 0 && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={10} className="text-current" />
                {report.replyCount} repl{report.replyCount === 1 ? "y" : "ies"}
              </span>
            </>
          )}
          {isPendingRequest && (
            <>
              <span>•</span>
              <span className="text-emerald-600">needs review</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pr-1 shrink-0">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete"
          >
            <Trash2 size={12} className="text-current" />
          </button>
        )}
        <ChevronRight size={16} className="text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all text-current" />
      </div>
    </div>
  );
};
