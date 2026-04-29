import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Plus,
  Check,
  Search,
  Link as LinkIcon,
  Unlink,
  Clock,
  CheckCircle2,
  Info as AlertCircle,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { TaskFormModal, type TaskRecord } from "./TaskFormModal";

interface TaskPickerModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** The milestone the user is adding tasks to. */
  milestoneId: string;
  /** Stage that the milestone belongs to — stamped onto picked tasks too. */
  stageId: string;
  /** Display label for the milestone (used in the modal title). */
  milestoneName?: string;
  /** Project members for the create-new task form. */
  members?: Array<{ email: string; userId?: string; role?: string }>;
}

const statusIcon = (s: string) =>
  s === "done" ? (
    <CheckCircle2 size={14} className="text-emerald-500 text-current" />
  ) : s === "progress" ? (
    <Clock size={14} className="text-amber-500 text-current" />
  ) : s === "cancelled" ? (
    <X size={14} className="text-muted-foreground text-current" />
  ) : (
    <AlertCircle size={14} className="text-red-500 text-current" />
  );

/**
 * Tasks live in one place — the Tasks module. Anywhere else (Execution, BOQ,
 * etc.) just *references* tasks. This modal lets you pick existing tasks to
 * link to a milestone, or create a brand-new task (which still goes through
 * the standard Tasks creation flow, then gets linked here on save).
 */
export const TaskPickerModal: React.FC<TaskPickerModalProps> = ({
  open,
  onClose,
  projectId,
  milestoneId,
  stageId,
  milestoneName,
  members = [],
}) => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId),
    enabled: open && !!projectId,
  });

  const [search, setSearch] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setShowCreateForm(false);
    }
  }, [open]);

  // Split tasks into "already linked to this milestone" vs the rest.
  const { linked, available } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (t: any) =>
      !q ||
      (t.title || "").toLowerCase().includes(q) ||
      (t.taskCode || "").toLowerCase().includes(q) ||
      (t.assigneeId || "").toLowerCase().includes(q) ||
      (t.assignee?.fullName || "").toLowerCase().includes(q) ||
      (t.assignee?.email || "").toLowerCase().includes(q);

    const linked: TaskRecord[] = [];
    const available: TaskRecord[] = [];
    for (const t of tasks as TaskRecord[]) {
      if ((t as any).milestoneId === milestoneId) {
        if (matches(t)) linked.push(t);
      } else {
        if (matches(t)) available.push(t);
      }
    }
    return { linked, available };
  }, [tasks, search, milestoneId]);

  const link = async (task: TaskRecord) => {
    setBusyTaskId(task.id);
    try {
      await api.updateTask(task.id, { milestoneId, stageId });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
    } catch (e: any) {
      alert(e?.message || "Failed to link task");
    } finally {
      setBusyTaskId(null);
    }
  };

  const unlink = async (task: TaskRecord) => {
    setBusyTaskId(task.id);
    try {
      await api.updateTask(task.id, { milestoneId: null, stageId: null });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
    } catch (e: any) {
      alert(e?.message || "Failed to unlink task");
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-black uppercase tracking-widest">Add Tasks</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                  Linking to <span className="text-foreground">{milestoneName || "this milestone"}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                title="Close"
              >
                <X size={16} className="text-current" />
              </button>
            </div>

            {/* Search + Create */}
            <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks by title, code, or assignee…"
                  className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-[12px] font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-border focus:bg-background transition-all"
                />
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md shrink-0"
                title="Create a new task in the Tasks module — it will be linked to this milestone automatically"
              >
                <Plus size={12} className="text-current" /> New Task
              </button>
            </div>

            {/* Lists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {isLoading ? (
                <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
                  Loading…
                </div>
              ) : (
                <>
                  {/* Linked group */}
                  {linked.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2 flex items-center gap-1.5">
                        <Check size={11} className="text-current" /> Linked ({linked.length})
                      </h3>
                      <div className="space-y-1.5">
                        {linked.map((t) => (
                          <Row
                            key={t.id}
                            task={t}
                            actionLabel="Unlink"
                            actionIcon={<Unlink size={11} className="text-current" />}
                            actionTone="danger"
                            disabled={busyTaskId === t.id}
                            onAction={() => unlink(t)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available group */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      Available ({available.length})
                    </h3>
                    {available.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground/60">
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          {tasks.length === 0
                            ? "No tasks in this project yet"
                            : "No more tasks to link"}
                        </p>
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="mt-3 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80"
                        >
                          + Create a new one
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {available.map((t) => (
                          <Row
                            key={t.id}
                            task={t}
                            actionLabel="Link"
                            actionIcon={<LinkIcon size={11} className="text-current" />}
                            actionTone="primary"
                            disabled={busyTaskId === t.id}
                            onAction={() => link(t)}
                            note={
                              (t as any).milestoneId
                                ? "Currently in another milestone"
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border shrink-0 bg-muted/10">
              <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                Tasks are managed in the Tasks module — this just links them.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Create-new task form — pre-filled with this milestone's stage/id so
           the new task is automatically linked here on save. */}
      {showCreateForm && (
        <TaskFormModal
          open
          onClose={() => setShowCreateForm(false)}
          projectId={projectId}
          defaults={{ stageId, milestoneId }}
          members={members}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
            queryClient.invalidateQueries({ queryKey: ["execution-stages", projectId] });
            setShowCreateForm(false);
          }}
        />
      )}
    </AnimatePresence>
  );
};

const Row: React.FC<{
  task: TaskRecord;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionTone: "primary" | "danger";
  disabled?: boolean;
  onAction: () => void;
  note?: string;
}> = ({ task, actionLabel, actionIcon, actionTone, disabled, onAction, note }) => {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 border border-transparent hover:bg-muted/40 hover:border-border transition-all">
      <div className="mt-0.5 shrink-0">{statusIcon(task.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/60 rounded shrink-0">
            {task.taskCode}
          </span>
          <p className="text-[11px] font-bold leading-snug truncate">{task.title}</p>
          <span
            className={cn(
              "text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded shrink-0",
              task.priority === "high"
                ? "bg-red-500/10 text-red-500"
                : task.priority === "med"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-blue-500/10 text-blue-500",
            )}
          >
            {task.priority}
          </span>
        </div>
        {(note || task.assigneeId) && (
          <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-0.5 truncate">
            {note ? <span className="text-amber-500/80 mr-1.5">⚠ {note}</span> : null}
            {task.assigneeId
              ? `· ${(task as any).assignee?.fullName || (task as any).assignee?.email || task.assigneeId}`
              : ""}
          </p>
        )}
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className={cn(
          "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
          actionTone === "primary"
            ? "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            : "bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50",
        )}
      >
        {actionIcon} {disabled ? "…" : actionLabel}
      </button>
    </div>
  );
};
