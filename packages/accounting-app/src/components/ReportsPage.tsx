import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncedStore } from "@syncedstore/react";
import {
  ArrowLeft,
  Plus,
  ScrollText,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Info as AlertCircle,
  Trash2,
  MessageSquare,
  Clock,
  Ban,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { uiStore } from "../store";
import { ReportComposeModal } from "./ReportComposeModal";
import { ReportDetailModal } from "./ReportDetailModal";

type KindFilter = "all" | "note" | "incident" | "update" | "confirmation_request";

const fmtDate = (iso?: string | null): string => {
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

const KIND_META: Record<string, { label: string; icon: React.ComponentType<any>; tint: string }> = {
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

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, user } = useAuth();
  const queryClient = useQueryClient();

  // Same global search + view-mode plumbing as TasksDashboard.
  const ui = useSyncedStore(uiStore);
  const search = ui.settings.searchQuery || "";

  const [filter, setFilter] = useState<KindFilter>("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["field-reports", projectId, filter],
    queryFn: () =>
      api.listFieldReports(projectId!, filter !== "all" ? { kind: filter } : undefined),
    enabled: !!projectId && !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId!),
    enabled: !!projectId && !!user,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    enabled: !!user,
  });
  const activeProject = useMemo(
    () => allProjects.find((p: any) => p.id === projectId),
    [allProjects, projectId],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: reports.length,
      note: 0,
      incident: 0,
      update: 0,
      confirmation_request: 0,
    };
    (reports as any[]).forEach((r) => {
      c[r.kind] = (c[r.kind] || 0) + 1;
    });
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reports as any[]).filter((r) => {
      if (!q) return true;
      return (
        (r.title || "").toLowerCase().includes(q) ||
        (r.body || "").toLowerCase().includes(q) ||
        (r.reportCode || "").toLowerCase().includes(q) ||
        (r.authorId || "").toLowerCase().includes(q)
      );
    });
  }, [reports, search]);

  const handleDelete = async (r: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete report ${r.reportCode}? This will also remove its thread.`)) return;
    try {
      await api.deleteFieldReport(r.id);
      queryClient.invalidateQueries({ queryKey: ["field-reports", projectId] });
    } catch (err: any) {
      alert(err?.message || "Failed to delete");
    }
  };

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
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Field Reports</h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {reports.length} report{reports.length === 1 ? "" : "s"} · {(activeProject as any)?.name || "Project"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={14} className="text-current" />
            New Report
          </button>
        </div>
      </header>

      {/* Filter chips */}
      <div className="px-8 py-5 border-b border-border/50 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all || 0} />
        <FilterButton active={filter === "note"} onClick={() => setFilter("note")} label="Notes" count={counts.note || 0} dot="bg-blue-500" />
        <FilterButton active={filter === "update"} onClick={() => setFilter("update")} label="Updates" count={counts.update || 0} dot="bg-amber-500" />
        <FilterButton active={filter === "incident"} onClick={() => setFilter("incident")} label="Incidents" count={counts.incident || 0} dot="bg-red-500" />
        <FilterButton active={filter === "confirmation_request"} onClick={() => setFilter("confirmation_request")} label="Requests" count={counts.confirmation_request || 0} dot="bg-emerald-500" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/60 text-[11px] font-bold uppercase tracking-widest">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-32">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <ScrollText size={32} className="text-current" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-1">
              {reports.length === 0 ? "No reports yet" : "No matches"}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-tighter">
              {reports.length === 0
                ? "File the first one to start the conversation"
                : "Try a different filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {filtered.map((r) => {
              const meta = KIND_META[r.kind] || KIND_META.note;
              const Icon = meta.icon;
              const task = (tasks as any[]).find((t) => t.id === r.taskId);
              const resolution = r.resolution?.status as string | undefined;
              const isPendingRequest =
                r.kind === "confirmation_request" && !resolution;
              return (
                <div
                  key={r.id}
                  onClick={() => setDetailId(r.id)}
                  className="group flex items-start gap-4 p-4 bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 rounded-2xl transition-all cursor-pointer"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/50",
                      meta.tint,
                    )}
                  >
                    <Icon size={16} className="text-current" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded shrink-0">
                        {r.reportCode}
                      </span>
                      <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0", meta.tint)}>
                        {meta.label}
                      </span>
                      {task && (
                        <span className="text-[8px] font-mono font-black text-muted-foreground/70 px-1 py-0.5 bg-muted/40 rounded shrink-0 inline-flex items-center gap-1">
                          <span className="opacity-60">Ref:</span> {task.taskCode}
                        </span>
                      )}
                      {r.kind === "confirmation_request" && (
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
                    <h4 className="text-xs font-bold truncate group-hover:text-primary transition-colors mb-1">
                      {r.title || (r.body || "").split("\n")[0] || "Untitled report"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {r.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      <span>{r.authorId || "Unknown"}</span>
                      <span>•</span>
                      <span>{fmtDate(r.createdAt)}</span>
                      {(r.replyCount || 0) > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare size={10} className="text-current" />
                            {r.replyCount} repl{r.replyCount === 1 ? "y" : "ies"}
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
                    <button
                      onClick={(e) => handleDelete(r, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-current" />
                    </button>
                    <ChevronRight size={16} className="text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all text-current" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <ReportComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        projectId={projectId}
        tasks={tasks as any[]}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["field-reports", projectId] });
          setComposeOpen(false);
        }}
      />
      {detailId && (
        <ReportDetailModal
          reportId={detailId}
          projectId={projectId}
          tasks={tasks as any[]}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["field-reports", projectId] });
            queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
          }}
        />
      )}
    </div>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}> = ({ active, onClick, label, count, dot }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
      active
        ? "bg-foreground text-background border-foreground shadow-md"
        : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-foreground/30",
    )}
  >
    {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
    {label}
    <span
      className={cn(
        "text-[9px] font-mono px-1.5 rounded-full tabular-nums",
        active ? "bg-background/20" : "bg-muted",
      )}
    >
      {count}
    </span>
  </button>
);

export default ReportsPage;
