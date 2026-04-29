import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncedStore } from "@syncedstore/react";
import {
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  ArrowLeft,
  MapPin,
  Calendar,
  User as UserIcon,
  Trash2,
  Info as AlertCircle,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { uiStore } from "../store";
import { TaskFormModal, type TaskRecord } from "./TaskFormModal";
import { BoqTaskGeneratorModal } from "./BoqTaskGeneratorModal";
import { Boxes } from "../lib/icons/lucide";

type Status = "all" | "pending" | "progress" | "done" | "cancelled";

const formatDeadline = (iso?: string | null) => {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const statusColor = (s: string) =>
  s === "done"
    ? "bg-emerald-500/10 text-emerald-500"
    : s === "progress"
      ? "bg-amber-500/10 text-amber-500"
      : s === "cancelled"
        ? "bg-muted text-muted-foreground"
        : "bg-red-500/10 text-red-500";

const statusIcon = (s: string) =>
  s === "done"
    ? <CheckCircle2 size={18} />
    : s === "progress"
      ? <Clock size={18} />
      : <AlertCircle size={18} />;

const priorityColor = (p: string) =>
  p === "high"
    ? "bg-red-500/10 text-red-500"
    : p === "med"
      ? "bg-amber-500/10 text-amber-500"
      : "bg-blue-500/10 text-blue-500";

export const TasksDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, user } = useAuth();
  const queryClient = useQueryClient();

  // Reuse the global search and view-mode toggle from MainLayout's nav so
  // every module behaves identically. We don't render our own copies.
  const ui = useSyncedStore(uiStore);
  const search = ui.settings.searchQuery || "";
  const viewMode = (ui.settings.viewMode || "list") as "list" | "grid";

  const [filter, setFilter] = useState<Status>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [boqModalOpen, setBoqModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);

  // Tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.listTasks(projectId!),
    enabled: !!projectId && !!user,
  });

  // Active project (for member list)
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    enabled: !!user,
  });
  const activeProject = useMemo(
    () => allProjects.find((p: any) => p.id === projectId),
    [allProjects, projectId],
  );
  const projectMembers = useMemo(() => {
    return ((activeProject as any)?.members || []).map((m: any) =>
      typeof m === "string"
        ? { email: m, userId: m }
        : { email: m.email, userId: m.userId || m.email, role: m.role },
    );
  }, [activeProject]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks as TaskRecord[]).filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.taskCode?.toLowerCase().includes(q) ||
        t.assigneeId?.toLowerCase().includes(q) ||
        // Match the hydrated assignee fullName/email so users can search
        // by human name, not just by uid.
        (t as any).assignee?.fullName?.toLowerCase().includes(q) ||
        (t as any).assignee?.email?.toLowerCase().includes(q) ||
        t.locationText?.toLowerCase().includes(q)
      );
    });
  }, [tasks, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length, pending: 0, progress: 0, done: 0, cancelled: 0 };
    (tasks as TaskRecord[]).forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
    });
    return c;
  }, [tasks]);

  const handleSaved = (saved: TaskRecord) => {
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  };

  const handleDelete = async (t: TaskRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete task ${t.taskCode}? This cannot be undone.`)) return;
    try {
      await api.deleteTask(t.id);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch (err: any) {
      alert(err?.message || "Failed to delete");
    }
  };

  if (!projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <AlertCircle size={32} />
        <p className="text-[11px] font-bold uppercase tracking-widest mt-3">No active project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Sub-header — mirrors the ProjectsPage / Project Repositories pattern */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} className="text-current" />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Tasks</h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} · {(activeProject as any)?.name || "Project"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBoqModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            title="Pull line items from a BOQ in this project"
          >
            <Boxes size={14} className="text-current" />
            From BOQ
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={14} className="text-current" />
            New Task
          </button>
        </div>
      </header>

      {/* Filter chips — search + view-mode live in MainLayout's nav */}
      <div className="px-8 py-5 border-b border-border/50 flex items-center gap-3 overflow-x-auto no-scrollbar">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all || 0} />
        <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")} label="Pending" count={counts.pending || 0} dot="bg-red-500" />
        <FilterButton active={filter === "progress"} onClick={() => setFilter("progress")} label="In Progress" count={counts.progress || 0} dot="bg-amber-500" />
        <FilterButton active={filter === "done"} onClick={() => setFilter("done")} label="Completed" count={counts.done || 0} dot="bg-emerald-500" />
        <FilterButton active={filter === "cancelled"} onClick={() => setFilter("cancelled")} label="Cancelled" count={counts.cancelled || 0} dot="bg-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/60 text-[11px] font-bold uppercase tracking-widest">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-32">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={32} className="text-current" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-1">
              {tasks.length === 0 ? "No tasks yet" : "Clear horizon"}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-tighter">
              {tasks.length === 0 ? "Create your first task to get going" : "No tasks match your filters"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {(filtered as TaskRecord[]).map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setEditing(t);
                  setModalOpen(true);
                }}
                className="group flex items-center gap-4 p-4 bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 rounded-2xl transition-all cursor-pointer"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/50 transition-colors",
                    statusColor(t.status),
                  )}
                >
                  {statusIcon(t.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-mono font-black text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded shrink-0">{t.taskCode}</span>
                    <h4 className="text-xs font-bold truncate group-hover:text-primary transition-colors">{t.title}</h4>
                    <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0", priorityColor(t.priority))}>
                      {t.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    {t.locationText && (
                      <>
                        <span className="flex items-center gap-1"><MapPin size={10} className="text-current" /> {t.locationText}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{formatDeadline(t.deadline)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center">
                      <UserIcon size={12} className="text-muted-foreground/50 text-current" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[120px]">
                      {t.assignee?.fullName || t.assignee?.email || t.assigneeId || "Unassigned"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(t, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} className="text-current" />
                  </button>
                  <ChevronRight size={16} className="text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all text-current" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(filtered as TaskRecord[]).map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setEditing(t);
                  setModalOpen(true);
                }}
                className="group p-5 bg-card border border-border/50 hover:border-primary/40 rounded-3xl transition-all cursor-pointer flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", statusColor(t.status))}>
                    {t.status}
                  </div>
                  <div className="text-[9px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest">{t.taskCode}</div>
                </div>

                <h4 className="text-sm font-bold mb-4 flex-1 line-clamp-3 group-hover:text-primary transition-colors">{t.title}</h4>

                <div className="space-y-3 pt-4 border-t border-border/40">
                  {t.locationText && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                      <MapPin size={12} className="text-primary text-current" />
                      <span className="truncate">{t.locationText}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center">
                        <UserIcon size={12} className="text-muted-foreground/50 text-current" />
                      </div>
                      <span className="text-[10px] font-bold text-foreground/70 truncate max-w-[110px]">
                        {t.assignee?.fullName || t.assignee?.email || t.assigneeId || "Unassigned"}
                      </span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", t.priority === "high" ? "bg-red-500" : t.priority === "med" ? "bg-amber-500" : "bg-blue-500")} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60">
                    <Calendar size={11} className="text-current" />
                    <span>{formatDeadline(t.deadline)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <TaskFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        projectId={projectId}
        editing={editing}
        members={projectMembers}
        onSaved={handleSaved}
      />

      {/* Generate-from-BOQ modal */}
      <BoqTaskGeneratorModal
        open={boqModalOpen}
        onClose={() => setBoqModalOpen(false)}
        projectId={projectId}
        onTasksGenerated={() => {
          queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
        }}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

const FilterButton: React.FC<{ active: boolean; onClick: () => void; label: string; count: number; dot?: string }> = ({
  active,
  onClick,
  label,
  count,
  dot,
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-xl transition-all border shrink-0",
      active
        ? "bg-card border-primary/30 text-foreground shadow-sm"
        : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50",
    )}
  >
    {dot && <div className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular-nums", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{count}</span>
  </button>
);
