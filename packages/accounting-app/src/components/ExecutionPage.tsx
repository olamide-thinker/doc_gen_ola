import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  Layers,
  Clock,
  Sparkles,
  Check,
  X,
  Maximize2,
  User as UserIcon,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { TaskFormModal, type TaskRecord } from "./TaskFormModal";
import { TaskPickerModal } from "./TaskPickerModal";

// ── Types ─────────────────────────────────────────────────────────────────

type Status = "pending" | "active" | "done" | "cancelled";

interface MilestoneRow {
  id: string;
  name: string;
  description?: string | null;
  note?: string | null;
  status: Status;
  position: number;
  taskCount?: number;
  taskDoneCount?: number;
  computedStatus?: Status;
}

interface StageRow {
  id: string;
  name: string;
  timeline?: string | null;
  description?: string | null;
  note?: string | null;
  status: Status;
  position: number;
  milestoneCount?: number;
  milestoneDoneCount?: number;
  computedStatus?: Status;
  milestones?: MilestoneRow[];
}

interface ExecutionPlan {
  estimatedTimeline?: string;
  conditions?: string;
}

const STATUS_TINT: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-amber-500/15 text-amber-600",
  done: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/10 text-destructive",
};

// ── Page ──────────────────────────────────────────────────────────────────

const ExecutionPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeProjectId } = useParams<{ id: string }>();
  const { projectId: ctxProjectId, user } = useAuth();
  const projectId = routeProjectId || ctxProjectId || null;
  const queryClient = useQueryClient();

  // Stages (with milestones nested)
  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["execution-stages", projectId],
    queryFn: () => api.listStages(projectId!),
    enabled: !!projectId && !!user,
  });

  // Execution plan metadata (estimatedTimeline + conditions)
  const { data: planRemote } = useQuery({
    queryKey: ["execution-plan", projectId],
    queryFn: () => api.getExecutionPlan(projectId!),
    enabled: !!projectId && !!user,
  });

  // Project (for the header subtitle)
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    enabled: !!user,
  });
  const activeProject: any = useMemo(
    () => allProjects.find((p: any) => p.id === projectId),
    [allProjects, projectId],
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stageForm, setStageForm] = useState<null | { editing?: StageRow }>(null);
  const [msForm, setMsForm] = useState<null | { stageId: string; editing?: MilestoneRow }>(null);

  // Focus mode — when set, the page swaps from the phase list to a single
  // phase's two-column workspace (milestones | tasks).
  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<null | { editing?: TaskRecord; milestoneId?: string; stageId?: string }>(null);
  // The "Add Task" button opens a picker (existing tasks) — not a fresh form.
  // Tasks are owned by the Tasks module; here we just link them.
  const [taskPicker, setTaskPicker] = useState<null | { milestoneId: string; stageId: string; milestoneName?: string }>(null);

  const focusedStage = useMemo(
    () => (stages as StageRow[]).find((s) => s.id === focusedStageId) || null,
    [stages, focusedStageId],
  );

  // When focusing a phase, default-select the first milestone.
  useEffect(() => {
    if (!focusedStage) {
      setSelectedMilestoneId(null);
      return;
    }
    const ms = focusedStage.milestones || [];
    if (ms.length === 0) {
      setSelectedMilestoneId(null);
      return;
    }
    if (!selectedMilestoneId || !ms.find((m) => m.id === selectedMilestoneId)) {
      setSelectedMilestoneId(ms[0].id);
    }
  }, [focusedStage, selectedMilestoneId]);

  // All project tasks — filtered client-side by milestone in the focus view.
  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId!),
    enabled: !!projectId && !!user && !!focusedStageId,
  });

  // Project members for the task form's assignee/supervisor pickers.
  const projectMembers = useMemo(() => {
    return ((activeProject as any)?.members || []).map((m: any) =>
      typeof m === "string"
        ? { email: m, userId: m }
        : { email: m.email, userId: m.userId || m.email, role: m.role },
    );
  }, [activeProject]);

  // Local plan state — debounced save so typing doesn't pound the API.
  const [planLocal, setPlanLocal] = useState<ExecutionPlan>({});
  const [planDirty, setPlanDirty] = useState(false);
  useEffect(() => {
    setPlanLocal(planRemote || {});
    setPlanDirty(false);
  }, [planRemote]);
  useEffect(() => {
    if (!planDirty || !projectId) return;
    const t = setTimeout(() => {
      api
        .updateExecutionPlan(projectId, planLocal)
        .then(() => {
          setPlanDirty(false);
          queryClient.invalidateQueries({ queryKey: ["execution-plan", projectId] });
        })
        .catch((err) => console.warn("[Execution] plan save failed:", err));
    }, 800);
    return () => clearTimeout(t);
  }, [planLocal, planDirty, projectId, queryClient]);

  const applyTemplate = useMutation({
    mutationFn: (force: boolean) => api.applyExecutionTemplate(projectId!, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["execution-plan", projectId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to apply template"),
  });

  const handleApplyTemplate = () => {
    if (stages.length > 0) {
      if (!confirm("Replace the existing execution plan with the 7-phase template? Existing stages and milestones will be removed.")) return;
      applyTemplate.mutate(true);
    } else {
      applyTemplate.mutate(false);
    }
  };

  if (!projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <Layers size={32} />
        <p className="text-[11px] font-bold uppercase tracking-widest mt-3">No active project</p>
      </div>
    );
  }

  // ── Focus view ────────────────────────────────────────────────────────
  if (focusedStage) {
    const milestones = focusedStage.milestones || [];
    const selectedMilestone = milestones.find((m) => m.id === selectedMilestoneId) || null;
    const milestoneTasks = selectedMilestone
      ? (allTasks as TaskRecord[]).filter((t: any) => t.milestoneId === selectedMilestone.id)
      : [];
    const focusStatus = (focusedStage.computedStatus || focusedStage.status) as Status;

    return (
      <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
        {/* Sub-header — back to phase list, phase title centred */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => setFocusedStageId(null)}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Back to all phases"
            >
              <ArrowLeft size={18} className="text-current" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground truncate">
                  {focusedStage.name}
                </h1>
                {focusedStage.timeline && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                    <Clock size={9} className="text-current" />
                    {focusedStage.timeline}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                    STATUS_TINT[focusStatus],
                  )}
                >
                  {focusStatus}
                </span>
              </div>
              <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                {milestones.length} milestone{milestones.length === 1 ? "" : "s"} · {activeProject?.name || "Project"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStageForm({ editing: focusedStage })}
              className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Edit size={12} className="text-current" /> Edit Phase
            </button>
            <button
              onClick={() => setMsForm({ stageId: focusedStage.id })}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={14} className="text-current" /> New Milestone
            </button>
          </div>
        </header>

        {/* Two-column workspace */}
        <div className="flex-1 grid grid-cols-[300px_1fr] divide-x divide-border min-h-0">
          {/* Milestones rail */}
          <aside className="flex flex-col bg-muted/10 min-h-0">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Scope &amp; Milestones
              </h3>
              <span className="text-[9px] font-bold text-muted-foreground/70 tabular-nums">
                {focusedStage.milestoneDoneCount ?? 0}/{milestones.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {milestones.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <Layers size={24} className="mx-auto mb-2 text-muted-foreground/40 text-current" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    No milestones
                  </p>
                  <button
                    onClick={() => setMsForm({ stageId: focusedStage.id })}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80"
                  >
                    + Add the first one
                  </button>
                </div>
              ) : (
                milestones.map((m) => {
                  const isSelected = selectedMilestoneId === m.id;
                  const mStatus = (m.computedStatus || m.status) as Status;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMilestoneId(m.id)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-lg transition-all border group",
                        isSelected
                          ? "bg-primary/10 border-primary/30 shadow-sm"
                          : "bg-card border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 bg-background">
                          {mStatus === "done" && (
                            <Check size={9} className="text-emerald-500 text-current" strokeWidth={4} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-snug line-clamp-2">{m.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {(m.taskCount ?? 0) > 0 && (
                              <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums">
                                {m.taskDoneCount ?? 0}/{m.taskCount} tasks
                              </span>
                            )}
                            <span className={cn("text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded", STATUS_TINT[mStatus])}>
                              {mStatus}
                            </span>
                          </div>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMsForm({ stageId: focusedStage.id, editing: m });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setMsForm({ stageId: focusedStage.id, editing: m });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 mt-0.5 cursor-pointer"
                        >
                          <Edit size={11} className="text-current" />
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Tasks list */}
          <section className="flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tasks</h3>
                <p className="text-[10px] font-bold text-muted-foreground/70 truncate">
                  {selectedMilestone ? selectedMilestone.name : "Pick a milestone on the left"}
                </p>
              </div>
              {selectedMilestone && (
                <button
                  onClick={() =>
                    setTaskPicker({
                      milestoneId: selectedMilestone.id,
                      stageId: focusedStage.id,
                      milestoneName: selectedMilestone.name,
                    })
                  }
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md shrink-0"
                  title="Pick from existing project tasks (or create new)"
                >
                  <Plus size={12} className="text-current" /> Add Task
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {!selectedMilestone ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/40 py-20">
                  <Layers size={32} className="mb-2 text-current" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    Pick a milestone on the left
                  </p>
                </div>
              ) : milestoneTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50 py-16">
                  <Check size={28} className="mb-2 text-current opacity-40" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No tasks yet for this milestone</p>
                  <button
                    onClick={() =>
                      setTaskPicker({
                        milestoneId: selectedMilestone.id,
                        stageId: focusedStage.id,
                        milestoneName: selectedMilestone.name,
                      })
                    }
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80"
                  >
                    + Add the first one
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {milestoneTasks.map((t: TaskRecord) => (
                    <button
                      key={t.id}
                      onClick={() => setTaskForm({ editing: t })}
                      className="w-full flex items-center gap-3 p-3 bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 rounded-lg transition-all group text-left"
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border/50 text-current",
                          t.status === "done"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : t.status === "progress"
                              ? "bg-amber-500/10 text-amber-500"
                              : t.status === "cancelled"
                                ? "bg-muted text-muted-foreground"
                                : "bg-red-500/10 text-red-500",
                        )}
                      >
                        {t.status === "done" ? (
                          <Check size={14} className="text-current" />
                        ) : (
                          <Clock size={14} className="text-current" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded shrink-0">
                            {t.taskCode}
                          </span>
                          <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{t.title}</span>
                          <span
                            className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                              t.priority === "high"
                                ? "bg-red-500/10 text-red-500"
                                : t.priority === "med"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-blue-500/10 text-blue-500",
                            )}
                          >
                            {t.priority}
                          </span>
                        </div>
                        {t.assigneeId && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <UserIcon size={10} className="text-muted-foreground/60 text-current" />
                            <span className="text-[10px] font-bold text-muted-foreground truncate">
                              {(t as any).assignee?.fullName || (t as any).assignee?.email || t.assigneeId}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all text-current shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Modals — same set as the list view */}
        {stageForm && (
          <StageFormModal
            projectId={projectId}
            editing={stageForm.editing}
            onClose={() => setStageForm(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
              setStageForm(null);
            }}
          />
        )}
        {msForm && (
          <MilestoneFormModal
            stageId={msForm.stageId}
            editing={msForm.editing}
            onClose={() => setMsForm(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
              setMsForm(null);
            }}
          />
        )}
        {/* Task editor — only used when clicking an existing task in the
            list to edit it. Creation flows go through the picker → which
            opens its own TaskFormModal pre-filled with stage/milestone. */}
        {taskForm && (
          <TaskFormModal
            open={true}
            onClose={() => setTaskForm(null)}
            projectId={projectId}
            editing={taskForm.editing || null}
            defaults={
              taskForm.editing
                ? undefined
                : {
                    stageId: taskForm.stageId,
                    milestoneId: taskForm.milestoneId,
                  }
            }
            members={projectMembers}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
              queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
              setTaskForm(null);
            }}
          />
        )}

        {/* Task picker — surfaces existing project tasks. Tasks are owned
            by the Tasks module; here we just link them to a milestone. */}
        {taskPicker && (
          <TaskPickerModal
            open
            onClose={() => setTaskPicker(null)}
            projectId={projectId}
            milestoneId={taskPicker.milestoneId}
            stageId={taskPicker.stageId}
            milestoneName={taskPicker.milestoneName}
            members={projectMembers}
          />
        )}

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Sticky sub-header (mirrors ProjectsPage / Tasks) */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} className="text-current" />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Execution Plan</h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {stages.length} phase{stages.length === 1 ? "" : "s"} · {activeProject?.name || "Project"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyTemplate}
            disabled={applyTemplate.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            title="Apply the canonical 7-phase interior-execution template"
          >
            <Sparkles size={14} className="text-current" />
            {applyTemplate.isPending ? "Applying…" : "Use Template"}
          </button>
          <button
            onClick={() => setStageForm({})}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={14} className="text-current" />
            New Phase
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
        {/* Plan card — duration + conditions */}
        <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Project Duration (Execution)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Estimated Timeline
              </label>
              <input
                value={planLocal.estimatedTimeline || ""}
                onChange={(e) => {
                  setPlanLocal((p) => ({ ...p, estimatedTimeline: e.target.value }));
                  setPlanDirty(true);
                }}
                placeholder="e.g. 12 Weeks"
                className="px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm font-bold focus:outline-none focus:border-border focus:bg-background"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Project Notes &amp; Conditions
              </label>
              <textarea
                value={planLocal.conditions || ""}
                onChange={(e) => {
                  setPlanLocal((p) => ({ ...p, conditions: e.target.value }));
                  setPlanDirty(true);
                }}
                rows={3}
                placeholder="Final duration is subject to procurement lead times and site conditions…"
                className="px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm leading-relaxed focus:outline-none focus:border-border focus:bg-background resize-y"
              />
            </div>
          </div>
        </section>

        {/* Phases */}
        {loadingStages ? (
          <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
            Loading…
          </div>
        ) : stages.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center text-muted-foreground/60">
            <Layers size={32} className="mb-3 text-current opacity-40" />
            <h3 className="text-sm font-bold uppercase tracking-widest mb-1 text-muted-foreground">
              No phases yet
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-tighter mb-5">
              Start with the 7-phase template, or add your own
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyTemplate}
                disabled={applyTemplate.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles size={14} className="text-current" />
                Apply Template
              </button>
              <button
                onClick={() => setStageForm({})}
                className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground hover:text-foreground border border-border rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                <Plus size={14} className="text-current" />
                New Phase
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(stages as StageRow[]).map((stage, idx) => {
              const isOpen = expanded.has(stage.id);
              const status = (stage.computedStatus || stage.status) as Status;
              const milestones = stage.milestones || [];
              return (
                <div
                  key={stage.id}
                  className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Phase header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        if (next.has(stage.id)) next.delete(stage.id);
                        else next.add(stage.id);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      size={16}
                      className={cn(
                        "text-muted-foreground/60 transition-transform shrink-0 text-current",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                    />
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[11px] shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-sm font-black uppercase tracking-tight">{stage.name}</h3>
                        {stage.timeline && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            <Clock size={9} className="text-current" />
                            {stage.timeline}
                          </span>
                        )}
                      </div>
                      {stage.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{stage.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(stage.milestoneCount ?? 0) > 0 && (
                        <span className="text-[9px] font-mono font-bold text-muted-foreground tabular-nums">
                          {stage.milestoneDoneCount ?? 0}/{stage.milestoneCount}
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                          STATUS_TINT[status],
                        )}
                      >
                        {status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStageForm({ editing: stage });
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                        title="Edit phase"
                      >
                        <Edit size={12} className="text-current" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedStageId(stage.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                        title="Focus on this phase"
                      >
                        <Maximize2 size={12} className="text-current" />
                      </button>
                    </div>
                  </div>

                  {/* Phase body */}
                  {isOpen && (
                    <div className="border-t border-border bg-background/30 p-4 space-y-3">
                      {(stage.description || stage.note) && (
                        <div className="text-[12px] text-muted-foreground/90 leading-relaxed space-y-1.5">
                          {stage.description && <p>{stage.description}</p>}
                          {stage.note && (
                            <p className="text-[11px] italic text-muted-foreground/70">
                              <span className="text-[9px] font-black uppercase tracking-widest mr-1.5 text-muted-foreground">Note</span>
                              {stage.note}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Milestones */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Scope &amp; Milestones
                          </h4>
                          <button
                            onClick={() => setMsForm({ stageId: stage.id })}
                            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80"
                          >
                            <Plus size={11} className="text-current" /> Add
                          </button>
                        </div>
                        {milestones.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground/60 italic py-3 text-center">
                            No milestones yet
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {milestones.map((m) => {
                              const mStatus = (m.computedStatus || m.status) as Status;
                              return (
                                <div
                                  key={m.id}
                                  className="flex items-start gap-3 p-2.5 rounded-lg bg-card border border-border/60 group"
                                >
                                  <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 bg-background">
                                    {mStatus === "done" && (
                                      <Check size={9} className="text-emerald-500 text-current" strokeWidth={4} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-[11px] font-bold leading-snug">{m.name}</p>
                                      {(m.taskCount ?? 0) > 0 && (
                                        <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums">
                                          {m.taskDoneCount ?? 0}/{m.taskCount} tasks
                                        </span>
                                      )}
                                      <span
                                        className={cn(
                                          "text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded",
                                          STATUS_TINT[mStatus],
                                        )}
                                      >
                                        {mStatus}
                                      </span>
                                    </div>
                                    {m.description && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{m.description}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setMsForm({ stageId: stage.id, editing: m })}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded transition-opacity"
                                    title="Edit milestone"
                                  >
                                    <Edit size={11} className="text-current" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-border/40">
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete phase "${stage.name}" and all its milestones?`)) return;
                            try {
                              await api.deleteStage(stage.id);
                              queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
                            } catch (e: any) {
                              alert(e?.message || "Failed to delete");
                            }
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-destructive/70 hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 size={11} className="text-current" /> Delete phase
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stage create/edit modal */}
      {stageForm && (
        <StageFormModal
          projectId={projectId}
          editing={stageForm.editing}
          onClose={() => setStageForm(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
            setStageForm(null);
          }}
        />
      )}

      {/* Milestone create/edit modal */}
      {msForm && (
        <MilestoneFormModal
          stageId={msForm.stageId}
          editing={msForm.editing}
          onClose={() => setMsForm(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
            setMsForm(null);
          }}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
      `}</style>
    </div>
  );
};

// ── Stage form modal ──────────────────────────────────────────────────────

const StageFormModal: React.FC<{
  projectId: string;
  editing?: StageRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name || "");
  const [timeline, setTimeline] = useState(editing?.timeline || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [note, setNote] = useState(editing?.note || "");
  const [status, setStatus] = useState<Status>(editing?.status || "pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.updateStage(editing.id, { name, timeline, description, note, status });
      } else {
        await api.createStage({ projectId, name, timeline, description, note, status });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? `Edit ${editing.name}` : "New Phase"} onClose={onClose} onSave={save} saving={saving} error={error}>
      <Field label="Name" required>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Procurement & Sourcing"
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </Field>
      <Field label="Timeline">
        <input
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="e.g. Week 1, or Weeks 4–6"
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </Field>
      <Field label="Description (Scope)">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this phase covers — scope, deliverables, etc."
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background resize-y"
        />
      </Field>
      <Field label="Note">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — overlap, dependency, etc."
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        >
          {(["pending", "active", "done", "cancelled"] as Status[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
    </ModalShell>
  );
};

// ── Milestone form modal ──────────────────────────────────────────────────

const MilestoneFormModal: React.FC<{
  stageId: string;
  editing?: MilestoneRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ stageId, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [note, setNote] = useState(editing?.note || "");
  const [status, setStatus] = useState<Status>(editing?.status || "pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const save = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.updateMilestone(editing.id, { name, description, note, status });
      } else {
        await api.createMilestone({ stageId, name, description, note, status });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`Delete milestone "${editing.name}"?`)) return;
    try {
      await api.deleteMilestone(editing.id);
      onSaved();
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  return (
    <ModalShell
      title={editing ? `Edit milestone` : "New Milestone"}
      onClose={onClose}
      onSave={save}
      saving={saving}
      error={error}
      extraFooter={
        editing ? (
          <button
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-colors mr-auto"
          >
            <Trash2 size={11} className="text-current inline mr-1" /> Delete
          </button>
        ) : null
      }
    >
      <Field label="Name" required>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sourcing of furniture"
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detail the scope of this milestone"
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background resize-y"
        />
      </Field>
      <Field label="Note">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        >
          {(["pending", "active", "done", "cancelled"] as Status[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
    </ModalShell>
  );
};

// ── Tiny shared modal shell ──────────────────────────────────────────────

const ModalShell: React.FC<{
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  extraFooter?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, onClose, onSave, saving, error, extraFooter, children }) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Close">
            <X size={16} className="text-current" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
          {error && (
            <div className="text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0 bg-muted/10">
          {extraFooter}
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all"
          >
            <Check size={12} className="text-current" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
  </div>
);

export default ExecutionPage;
