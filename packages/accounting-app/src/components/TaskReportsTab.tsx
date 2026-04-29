import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ScrollText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { ReportRow } from "./ReportRow";
import { ReportComposeModal } from "./ReportComposeModal";
import { ReportDetailModal } from "./ReportDetailModal";

type KindFilter = "all" | "note" | "incident" | "update" | "confirmation_request";

interface TaskReportsTabProps {
  projectId: string;
  taskId: string;
}

/**
 * The Reports tab on a task modal. This is a thin filtered view over the
 * Field Reports module — it surfaces only reports filed about this task.
 * "+ New Report" opens the standard compose modal pre-filled with the
 * task id so the new report attaches automatically.
 */
export const TaskReportsTab: React.FC<TaskReportsTabProps> = ({ projectId, taskId }) => {
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");

  // Reports for this task. Backend already filters by taskId so the cache
  // key includes it — switching tasks doesn't show stale rows.
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["field-reports", projectId, "task", taskId, filter],
    queryFn: () =>
      api.listFieldReports(projectId, {
        taskId,
        ...(filter !== "all" ? { kind: filter } : {}),
      }),
    enabled: !!projectId && !!taskId,
  });

  // Project-wide tasks so the compose modal can offer the
  // confirmation-request target picker (often a different task than the
  // one we're viewing).
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId),
    enabled: !!projectId,
  });

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["field-reports", projectId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  };

  return (
    <div className="space-y-4">
      {/* Header strip — filter + new-report */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={counts.all || 0}
          />
          <ChipFilter
            active={filter === "update"}
            onClick={() => setFilter("update")}
            icon={Sparkles}
            label="Updates"
            count={counts.update || 0}
            tint="text-amber-500"
          />
          <ChipFilter
            active={filter === "incident"}
            onClick={() => setFilter("incident")}
            icon={AlertTriangle}
            label="Incidents"
            count={counts.incident || 0}
            tint="text-red-500"
          />
          <ChipFilter
            active={filter === "confirmation_request"}
            onClick={() => setFilter("confirmation_request")}
            icon={CheckCircle2}
            label="Requests"
            count={counts.confirmation_request || 0}
            tint="text-emerald-600"
          />
          <ChipFilter
            active={filter === "note"}
            onClick={() => setFilter("note")}
            icon={ScrollText}
            label="Notes"
            count={counts.note || 0}
            tint="text-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all shrink-0"
          title="File a new report on this task"
        >
          <Plus size={11} className="text-current" /> New Report
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl px-6 py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
            <ScrollText size={20} className="text-muted-foreground/60 text-current" />
          </div>
          <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-1">
            No reports yet
          </h4>
          <p className="text-[10px] font-medium text-muted-foreground/70 leading-relaxed mb-4 max-w-sm mx-auto">
            File the first report — share an update, log an incident, or
            request a status change from your supervisor.
          </p>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all"
          >
            <Plus size={11} className="text-current" /> New Report
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {(reports as any[]).map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              hideTaskRef
              compact
              onClick={() => setDetailId(r.id)}
              onDelete={() => {
                if (
                  confirm(
                    `Delete report ${r.reportCode}? This will also remove its thread.`,
                  )
                ) {
                  api
                    .deleteFieldReport(r.id)
                    .then(refresh)
                    .catch((err: any) => alert(err?.message || "Failed to delete"));
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ReportComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        projectId={projectId}
        tasks={tasks as any[]}
        defaults={{ taskId, kind: "update" }}
        onCreated={() => {
          refresh();
          setComposeOpen(false);
        }}
      />
      {detailId && (
        <ReportDetailModal
          reportId={detailId}
          projectId={projectId}
          tasks={tasks as any[]}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
};

const ChipFilter: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ComponentType<any>;
  tint?: string;
}> = ({ active, onClick, label, count, icon: Icon, tint }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all border",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-foreground/30",
    )}
  >
    {Icon && <Icon size={10} className={cn("text-current", !active && tint)} />}
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
