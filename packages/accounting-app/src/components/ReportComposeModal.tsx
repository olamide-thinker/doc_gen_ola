import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ScrollText,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Search,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

type Kind = "note" | "incident" | "update" | "confirmation_request";
type TaskStatus = "pending" | "progress" | "done" | "cancelled";

interface ReportComposeModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Project tasks — used as the picker for the optional `taskId` and the
      required `request.targetTaskId`. */
  tasks: Array<{ id: string; taskCode: string; title: string; status: string }>;
  /**
   * Pre-fill the report with a task subject. When provided, the task picker
   * is collapsed and the kind defaults to 'update'. Used by the
   * Reports tab on the task modal so opening "+ New Report" from inside a
   * task lands the user mid-flow.
   */
  defaults?: { taskId?: string; kind?: Kind };
  onCreated: (created: any) => void;
}

const KIND_OPTIONS: Array<{
  id: Kind;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  tint: string;
}> = [
  { id: "note", label: "Note", description: "Quick observation or status",
    icon: ScrollText, tint: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { id: "update", label: "Update", description: "Progress narrative",
    icon: Sparkles, tint: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { id: "incident", label: "Incident", description: "Something went wrong",
    icon: AlertTriangle, tint: "bg-red-500/10 text-red-500 border-red-500/30" },
  {
    id: "confirmation_request",
    label: "Request",
    description: "Ask supervisor to update a task's status",
    icon: CheckCircle2,
    tint: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
];

const TASK_STATUSES: TaskStatus[] = ["pending", "progress", "done", "cancelled"];

export const ReportComposeModal: React.FC<ReportComposeModalProps> = ({
  open,
  onClose,
  projectId,
  tasks,
  defaults,
  onCreated,
}) => {
  const [kind, setKind] = useState<Kind>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [taskId, setTaskId] = useState<string>(""); // subject of the report
  const [taskSearch, setTaskSearch] = useState("");

  // Confirmation-request fields
  const [reqTaskId, setReqTaskId] = useState<string>("");
  const [reqStatus, setReqStatus] = useState<TaskStatus>("done");
  const [reqNote, setReqNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setKind(defaults?.kind || "note");
    setTitle("");
    setBody("");
    setTaskId(defaults?.taskId || "");
    setTaskSearch("");
    // For requests, default the target task to the report's subject (if any)
    setReqTaskId(defaults?.taskId || "");
    setReqStatus("done");
    setReqNote("");
  }, [open, defaults?.taskId, defaults?.kind]);

  const filteredTasks = (() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks.slice(0, 8);
    return tasks
      .filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          (t.taskCode || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  })();

  const canSubmit = (() => {
    if (!body.trim()) return false;
    if (kind === "confirmation_request") {
      if (!reqTaskId) return false;
      if (!TASK_STATUSES.includes(reqStatus)) return false;
    }
    return true;
  })();

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(
        kind === "confirmation_request" && !reqTaskId
          ? "Pick a task to update"
          : "Body is required",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        projectId,
        kind,
        body: body.trim(),
        title: title.trim() || undefined,
        taskId: taskId || undefined,
      };
      if (kind === "confirmation_request") {
        payload.request = {
          targetTaskId: reqTaskId,
          requestedStatus: reqStatus,
          note: reqNote.trim() || undefined,
        };
      }
      const created = await api.createFieldReport(payload);
      onCreated(created);
    } catch (e: any) {
      setError(e?.message || "Failed to create report");
    } finally {
      setSaving(false);
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
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">New Report</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  REP code is generated on save
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
              {/* Kind picker */}
              <Field label="Kind">
                <div className="grid grid-cols-2 gap-2">
                  {KIND_OPTIONS.map((k) => {
                    const Icon = k.icon;
                    const active = kind === k.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setKind(k.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all",
                          active
                            ? `${k.tint} ring-2 ring-inset ring-foreground/5`
                            : "bg-muted/30 border-border hover:bg-muted/50",
                        )}
                      >
                        <Icon size={14} className="text-current mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-widest">
                            {k.label}
                          </div>
                          <div
                            className={cn(
                              "text-[10px] font-medium leading-snug mt-0.5",
                              active ? "opacity-80" : "text-muted-foreground/70",
                            )}
                          >
                            {k.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Title (optional) */}
              <Field label="Title (optional)">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="One-line summary"
                  className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                />
              </Field>

              {/* Body */}
              <Field label="Body" required>
                <textarea
                  autoFocus
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What's happening?"
                  rows={5}
                  className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm leading-relaxed focus:outline-none focus:border-border focus:bg-background resize-y"
                />
              </Field>

              {/* Subject task (optional, except already pre-filled by defaults) */}
              <Field label="About task (optional)">
                <TaskPicker
                  value={taskId}
                  onChange={setTaskId}
                  search={taskSearch}
                  onSearchChange={setTaskSearch}
                  options={filteredTasks}
                  placeholder="No task — standalone report"
                />
              </Field>

              {/* Confirmation-request sub-form */}
              {kind === "confirmation_request" && (
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 text-current" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      Status change request
                    </h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Pick the task you want updated and the status you're asking for. A supervisor can accept (which applies the change) or decline.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
                        Target task
                      </label>
                      <select
                        value={reqTaskId}
                        onChange={(e) => setReqTaskId(e.target.value)}
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-foreground"
                      >
                        <option value="">Pick a task…</option>
                        {tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.taskCode} — {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
                        New status
                      </label>
                      <select
                        value={reqStatus}
                        onChange={(e) => setReqStatus(e.target.value as TaskStatus)}
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-foreground"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
                      Note for the reviewer (optional)
                    </label>
                    <input
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="e.g. completed ahead of schedule"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-foreground"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !canSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all"
              >
                <Check size={12} className="text-current" />
                {saving ? "Filing…" : "File Report"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

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

const TaskPicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  options: Array<{ id: string; taskCode: string; title: string; status: string }>;
  placeholder: string;
}> = ({ value, onChange, search, onSearchChange, options, placeholder }) => {
  const selected = options.find((o) => o.id === value);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={value ? `Linked: ${selected?.taskCode || "task"}` : placeholder}
          className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
        />
      </div>
      <div className="space-y-1 max-h-44 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors",
            !value
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/40",
          )}
        >
          None — standalone report
        </button>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors",
              value === o.id
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/40 text-foreground",
            )}
          >
            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-muted/60 rounded shrink-0">
              {o.taskCode}
            </span>
            <span className="text-[11px] font-bold truncate">{o.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
