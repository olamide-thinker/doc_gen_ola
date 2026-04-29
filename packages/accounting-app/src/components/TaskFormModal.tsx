import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  User as UserIcon,
  Check,
  Calculator,
  ScrollText,
  Layout,
  Sparkles,
  Edit2,
  Lock,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { TaskFinancialsTab } from "./TaskFinancialsTab";
import { TaskReportsTab } from "./TaskReportsTab";

// ── Types ────────────────────────────────────────────────────────────────
type TaskStatus = "pending" | "progress" | "done" | "cancelled";
type TaskPriority = "low" | "med" | "high";
type LocationType = "zone" | "text" | null;

export interface TaskRecord {
  id: string;
  taskCode: string;
  title: string;
  details?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  createdById?: string | null;
  supervisorId?: string | null;
  assigneeId?: string | null;
  crewIds?: string[] | null;
  materials?: Array<{ name: string; quantity?: number | string; unit?: string; note?: string }> | null;
  budget?: number | null;
  locationType?: LocationType;
  locationDocId?: string | null;
  locationZoneId?: string | null;
  locationText?: string | null;
  projectId: string;
  createdAt?: string;
  updatedAt?: string;
  // Hydrated user objects from the backend — present on list/detail/
  // create/update responses. Frontends should prefer these over the
  // raw *Id fields when rendering names.
  createdBy?: { id: string; fullName: string | null; email: string } | null;
  supervisor?: { id: string; fullName: string | null; email: string } | null;
  assignee?: { id: string; fullName: string | null; email: string } | null;
}

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** When set, the modal opens in edit mode for this task. */
  editing?: TaskRecord | null;
  /**
   * Initial values applied in CREATE mode (when `editing` is not set). Lets
   * callers pre-fill things like stageId / milestoneId — these aren't part of
   * the form's UI yet but are sent through to the backend on save.
   */
  defaults?: Partial<TaskRecord> & { stageId?: string; milestoneId?: string };
  /** Called after a successful create or update with the resulting record. */
  onSaved?: (task: TaskRecord) => void;
  /** List of project members for assignee/supervisor pickers. */
  members?: Array<{ email: string; userId?: string; role?: string }>;
}

const STATUSES: TaskStatus[] = ["pending", "progress", "done", "cancelled"];
const PRIORITIES: TaskPriority[] = ["low", "med", "high"];

type Tab = "overview" | "financials" | "reports";

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<any> }> = [
  { id: "overview", label: "Overview", icon: Layout },
  { id: "financials", label: "Financials", icon: Calculator },
  { id: "reports", label: "Field Reports", icon: ScrollText },
];

// Convert ISO timestamp into <input type="datetime-local"> value (yyyy-MM-ddTHH:mm).
const toLocalDateTimeInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  open,
  onClose,
  projectId,
  editing,
  defaults,
  onSaved,
  members = [],
}) => {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [supervisorId, setSupervisorId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [locationType, setLocationType] = useState<LocationType>(null);
  const [locationText, setLocationText] = useState("");
  const [materials, setMaterials] = useState<
    Array<{ name: string; quantity: string; unit: string; note: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  // Overview has two modes: "view" (read-only display, default for existing
  // tasks) and "edit" (the writable form). New tasks open straight in edit
  // mode since there's nothing to view yet. The split sets us up for
  // permission-gating later — e.g. crew can only ever land on view, while
  // supervisors get the edit affordance.
  const [mode, setMode] = useState<"view" | "edit">(editing ? "view" : "edit");

  // Snapshot the form back to the source-of-truth (editing record or caller
  // defaults). Called on open and on Cancel-from-edit so unsaved changes
  // don't bleed across sessions.
  const populateForm = useCallback(() => {
    setError(null);
    if (editing) {
      setTitle(editing.title || "");
      setDetails(editing.details || "");
      setStatus(editing.status || "pending");
      setPriority(editing.priority || "med");
      setDeadlineLocal(toLocalDateTimeInput(editing.deadline));
      setSupervisorId(editing.supervisorId || "");
      setAssigneeId(editing.assigneeId || "");
      setBudget(editing.budget != null ? String(editing.budget) : "");
      setLocationType(editing.locationType ?? null);
      setLocationText(editing.locationText || "");
      setMaterials(
        (editing.materials || []).map((m) => ({
          name: m.name || "",
          quantity: m.quantity != null ? String(m.quantity) : "",
          unit: m.unit || "",
          note: m.note || "",
        })),
      );
    } else {
      // Create mode — start blank, then layer in any caller-provided defaults
      // (e.g. when opened from a milestone, the parent passes a stageId +
      // milestoneId + a sensible title prefix).
      setTitle(defaults?.title || "");
      setDetails(defaults?.details || "");
      setStatus(defaults?.status || "pending");
      setPriority(defaults?.priority || "med");
      setDeadlineLocal(toLocalDateTimeInput(defaults?.deadline));
      setSupervisorId(defaults?.supervisorId || "");
      setAssigneeId(defaults?.assigneeId || "");
      setBudget(defaults?.budget != null ? String(defaults.budget) : "");
      setLocationType(defaults?.locationType ?? null);
      setLocationText(defaults?.locationText || "");
      setMaterials(
        (defaults?.materials || []).map((m: any) => ({
          name: m?.name || "",
          quantity: m?.quantity != null ? String(m.quantity) : "",
          unit: m?.unit || "",
          note: m?.note || "",
        })),
      );
    }
  }, [editing, defaults]);

  // Reset form (and mode + tab) when (re)opened or when target changes.
  useEffect(() => {
    if (!open) return;
    // Always land back on Overview when (re)opening — financials/reports are
    // contextual peeks, not where you start a session.
    setTab("overview");
    setMode(editing ? "view" : "edit");
    populateForm();
  }, [open, editing?.id, defaults?.stageId, defaults?.milestoneId]);

  const memberOptions = useMemo(
    () =>
      members
        .filter((m) => !!m.email)
        .map((m) => ({
          value: m.userId || m.email,
          label: m.email,
        })),
    [members],
  );

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: any = {
      projectId,
      title: title.trim(),
      details: details.trim() || undefined,
      status,
      priority,
      deadline: deadlineLocal ? new Date(deadlineLocal).toISOString() : null,
      supervisorId: supervisorId || null,
      assigneeId: assigneeId || null,
      budget: budget ? Number(budget) : null,
      locationType,
      locationText: locationType === "text" ? locationText : null,
      materials: materials
        .map((m) => ({
          name: m.name.trim(),
          quantity: m.quantity ? Number(m.quantity) || m.quantity : undefined,
          unit: m.unit.trim() || undefined,
          note: m.note.trim() || undefined,
        }))
        .filter((m) => m.name),
    };

    // Forward stage/milestone IDs (in create mode the parent passes them via
    // `defaults`; in edit mode they're already on the task and we don't touch
    // them unless the caller explicitly overrides).
    if (!editing) {
      if (defaults?.stageId) payload.stageId = defaults.stageId;
      if (defaults?.milestoneId) payload.milestoneId = defaults.milestoneId;
    }

    try {
      const result = editing
        ? await api.updateTask(editing.id, payload)
        : await api.createTask(payload);
      onSaved?.(result as TaskRecord);
      // For an existing task, drop back into view mode with the freshly
      // saved values still in form state — the modal stays open so the user
      // can keep browsing tabs / re-entering edit. Only new-task creates
      // close the modal (the parent typically reopens with the new record).
      if (editing) {
        setMode("view");
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save");
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
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {editing && (
                  <span className="text-[10px] font-mono font-black px-2 py-1 bg-muted text-muted-foreground rounded-md shrink-0 tracking-tight">
                    {editing.taskCode}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-widest truncate">
                    {editing ? "Task Overview" : "New Task"}
                  </h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                    {editing ? editing.title || "Untitled" : "Code is generated on save"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
                title="Close"
              >
                <X size={16} className="text-current" />
              </button>
            </div>

            {/* Tabs — only meaningful in edit mode (you can't link financials
                or reports to a task that doesn't exist yet). */}
            {editing && (
              <div className="flex items-center gap-1 px-3 pt-2 border-b border-border shrink-0 bg-muted/10">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-all relative",
                        isActive
                          ? "text-foreground bg-card"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      <Icon size={12} className="text-current" />
                      {t.label}
                      {isActive && (
                        <span className="absolute -bottom-px left-2 right-2 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Body */}
            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar px-6 py-5",
              tab === "overview" && "space-y-5",
            )}>
            {tab === "overview" && (
              <>
              {/* View ↔ Edit toggle — only meaningful for existing tasks. New
                  tasks live in edit mode the entire time. */}
              {editing && (
                <div className="flex items-center justify-between gap-3 -mb-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    {mode === "view" ? (
                      <>
                        <Lock size={10} className="text-current" /> Read-only
                      </>
                    ) : (
                      <>
                        <Edit2 size={10} className="text-current" /> Editing
                      </>
                    )}
                  </div>
                  {mode === "view" ? (
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
                      title="Edit this task"
                    >
                      <Edit2 size={11} className="text-current" /> Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        // Revert any unsaved changes and pop back to view.
                        populateForm();
                        setMode("view");
                      }}
                      disabled={saving}
                      className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Discard changes
                    </button>
                  )}
                </div>
              )}

              {/* View-mode body — clean read-only display of the task. */}
              {mode === "view" && editing && (
                <ViewModeBody
                  title={title}
                  details={details}
                  status={status}
                  priority={priority}
                  deadline={editing.deadline}
                  budget={budget}
                  supervisorId={supervisorId}
                  assigneeId={assigneeId}
                  supervisorUser={editing.supervisor}
                  assigneeUser={editing.assignee}
                  locationType={locationType}
                  locationText={locationText}
                  materials={materials}
                  members={members}
                />
              )}

              {/* Edit-mode body — the writable form. */}
              {mode === "edit" && (<>
              {/* Title */}
              <Field label="Title" required>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Clear north sector bushes"
                  className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                />
              </Field>

              {/* Details */}
              <Field label="Details">
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="What needs to happen, how, etc."
                  rows={3}
                  className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background resize-y"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Deadline">
                  <div className="relative">
                    <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="datetime-local"
                      value={deadlineLocal}
                      onChange={(e) => setDeadlineLocal(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                    />
                  </div>
                </Field>
                <Field label="Budget (₦)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Supervisor">
                  <MemberSelect
                    value={supervisorId}
                    onChange={setSupervisorId}
                    options={memberOptions}
                    placeholder="None"
                  />
                </Field>
                <Field label="Assignee">
                  <MemberSelect
                    value={assigneeId}
                    onChange={setAssigneeId}
                    options={memberOptions}
                    placeholder="Unassigned"
                  />
                </Field>
              </div>

              {/* Location */}
              <Field label="Location">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLocationType(locationType === "text" ? null : "text")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                        locationType === "text"
                          ? "bg-foreground text-background border-transparent"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/60",
                      )}
                    >
                      <MapPin size={11} className="inline mr-1 -mt-0.5 text-current" />
                      Free text
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Zone picker — coming with PlanEditor wiring (Phase 3)"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-muted/20 text-muted-foreground/50 border border-border/50 cursor-not-allowed"
                    >
                      Zone (soon)
                    </button>
                  </div>
                  {locationType === "text" && (
                    <input
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      placeholder="e.g. North wing, second floor"
                      className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
                    />
                  )}
                </div>
              </Field>

              {/* Materials */}
              <Field label="Materials Required">
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={m.name}
                        onChange={(e) =>
                          setMaterials((arr) =>
                            arr.map((row, idx) =>
                              idx === i ? { ...row, name: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Item"
                        className="flex-1 px-2.5 py-1.5 bg-muted/40 border border-transparent rounded-lg text-xs focus:outline-none focus:border-border focus:bg-background"
                      />
                      <input
                        value={m.quantity}
                        onChange={(e) =>
                          setMaterials((arr) =>
                            arr.map((row, idx) =>
                              idx === i ? { ...row, quantity: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Qty"
                        className="w-20 px-2.5 py-1.5 bg-muted/40 border border-transparent rounded-lg text-xs focus:outline-none focus:border-border focus:bg-background"
                      />
                      <input
                        value={m.unit}
                        onChange={(e) =>
                          setMaterials((arr) =>
                            arr.map((row, idx) =>
                              idx === i ? { ...row, unit: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Unit"
                        className="w-20 px-2.5 py-1.5 bg-muted/40 border border-transparent rounded-lg text-xs focus:outline-none focus:border-border focus:bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setMaterials((arr) => arr.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMaterials((arr) => [...arr, { name: "", quantity: "", unit: "", note: "" }])}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={12} /> Add material
                  </button>
                </div>
              </Field>

              {error && (
                <div className="text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              </>)}
              </>
            )}

            {tab === "financials" &&
              (editing ? (
                <TaskFinancialsTab projectId={projectId} taskId={editing.id} />
              ) : (
                <FinancialsTabStub />
              ))}
            {tab === "reports" &&
              (editing ? (
                <TaskReportsTab projectId={projectId} taskId={editing.id} />
              ) : (
                <ReportsTabStub />
              ))}
            </div>

            {/* Footer — view mode and the read-only tab stubs collapse to
                a single Close button. Edit mode keeps the Cancel + Save
                pair. */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              {tab === "overview" && mode === "edit" ? (
                <>
                  <button
                    onClick={() => {
                      // For an existing task, Cancel reverts unsaved edits and
                      // returns to view — the modal stays open. For a new
                      // task there's no view state to fall back to, so we
                      // close the modal.
                      if (editing) {
                        populateForm();
                        setMode("view");
                      } else {
                        onClose();
                      }
                    }}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all"
                  >
                    <Check size={12} className="text-current" /> {saving ? "Saving..." : editing ? "Save changes" : "Create task"}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border"
                >
                  Close
                </button>
              )}
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

// ── View-mode body ───────────────────────────────────────────────────────
// Read-only rendering of the Overview fields. Mirrors the data the form
// captures so the layout is one-to-one — no surprises when toggling between
// modes.

const STATUS_TINT: Record<TaskStatus, string> = {
  pending: "bg-red-500/10 text-red-500",
  progress: "bg-amber-500/10 text-amber-500",
  done: "bg-emerald-500/10 text-emerald-500",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_TINT: Record<TaskPriority, string> = {
  low: "bg-blue-500/10 text-blue-500",
  med: "bg-amber-500/10 text-amber-500",
  high: "bg-red-500/10 text-red-500",
};

const formatDeadline = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const memberLabel = (
  id: string,
  members: Array<{ email: string; userId?: string; role?: string }>,
): string => {
  const m = members.find((x) => (x.userId || x.email) === id);
  return m?.email || id;
};

const ViewModeBody: React.FC<{
  title: string;
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  budget: string;
  supervisorId: string;
  assigneeId: string;
  /** Hydrated user objects from the backend (preferred over id lookup). */
  supervisorUser?: { id: string; fullName: string | null; email: string } | null;
  assigneeUser?: { id: string; fullName: string | null; email: string } | null;
  locationType: LocationType;
  locationText: string;
  materials: Array<{ name: string; quantity: string; unit: string; note: string }>;
  members: Array<{ email: string; userId?: string; role?: string }>;
}> = ({
  title,
  details,
  status,
  priority,
  deadline,
  budget,
  supervisorId,
  assigneeId,
  supervisorUser,
  assigneeUser,
  locationType,
  locationText,
  materials,
  members,
}) => {
  const deadlineDisplay = formatDeadline(deadline);
  const budgetDisplay =
    budget && !isNaN(Number(budget))
      ? `₦${Number(budget).toLocaleString()}`
      : null;

  return (
    <div className="space-y-5">
      {/* Title block */}
      <div>
        <h3 className="text-lg font-black leading-tight text-foreground">
          {title || <span className="text-muted-foreground/60 italic">Untitled</span>}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span
            className={cn(
              "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
              STATUS_TINT[status],
            )}
          >
            {status}
          </span>
          <span
            className={cn(
              "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
              PRIORITY_TINT[priority],
            )}
          >
            {priority} priority
          </span>
          {budgetDisplay && (
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {budgetDisplay}
            </span>
          )}
        </div>
        {deadlineDisplay && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-muted-foreground">
            <Calendar size={11} className="text-current" /> Due {deadlineDisplay}
          </div>
        )}
      </div>

      {/* Details */}
      {details && (
        <ViewSection label="Details">
          <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {details}
          </p>
        </ViewSection>
      )}

      {/* People */}
      {(supervisorId || assigneeId) && (
        <ViewSection label="People">
          <div className="grid grid-cols-2 gap-3">
            <ViewPerson
              role="Supervisor"
              id={supervisorId}
              hydrated={supervisorUser}
              members={members}
            />
            <ViewPerson
              role="Assignee"
              id={assigneeId}
              hydrated={assigneeUser}
              members={members}
            />
          </div>
        </ViewSection>
      )}

      {/* Location */}
      {locationType === "text" && locationText && (
        <ViewSection label="Location">
          <div className="flex items-start gap-2 text-[12px] font-medium text-foreground/80">
            <MapPin size={12} className="mt-0.5 text-muted-foreground/70 text-current shrink-0" />
            <span>{locationText}</span>
          </div>
        </ViewSection>
      )}

      {/* Materials */}
      {materials.length > 0 && (
        <ViewSection label={`Materials (${materials.length})`}>
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {materials.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/10 text-[12px]"
              >
                <span className="font-medium truncate flex-1">{m.name}</span>
                {(m.quantity || m.unit) && (
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums shrink-0">
                    {m.quantity}
                    {m.unit ? ` ${m.unit}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ViewSection>
      )}

      {/* Empty hint when there's barely anything filled in. Helps signal
          this is read-only, not "the task is empty". */}
      {!details &&
        !supervisorId &&
        !assigneeId &&
        !(locationType === "text" && locationText) &&
        materials.length === 0 && (
          <div className="text-[11px] font-medium text-muted-foreground/60 italic border border-dashed border-border rounded-lg px-4 py-6 text-center">
            No additional details. Switch to Edit to fill them in.
          </div>
        )}
    </div>
  );
};

const ViewSection: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
      {label}
    </div>
    {children}
  </div>
);

const ViewPerson: React.FC<{
  role: string;
  id: string;
  hydrated?: { id: string; fullName: string | null; email: string } | null;
  members: Array<{ email: string; userId?: string; role?: string }>;
}> = ({ role, id, hydrated, members }) => {
  // Prefer the hydrated user from the backend (real fullName/email), fall
  // back to the project members lookup, then to the raw id as a last
  // resort so we never render a blank cell.
  const label = hydrated
    ? hydrated.fullName || hydrated.email
    : id
      ? memberLabel(id, members)
      : "";
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 rounded-lg border border-border/50">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
        <UserIcon size={12} className="text-muted-foreground text-current" />
      </div>
      <div className="min-w-0">
        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">
          {role}
        </div>
        {id ? (
          <div className="text-[11px] font-bold truncate">{label}</div>
        ) : (
          <div className="text-[11px] font-medium text-muted-foreground/60 italic">
            Unassigned
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tab stubs ────────────────────────────────────────────────────────────
// These are intentional "coming soon" placeholders so the tab layout is
// locked in before we build the underlying data flow.
//
// • Financials  → invoices/receipts get a `metadata.taskId` link, then this
//                 tab rolls up totalCost / totalPaid / balance and lists the
//                 linked documents with a "+ Link Invoice" picker.
// • Reports     → a separate field_reports module (sibling of Tasks) holds
//                 the data; this tab just filters that list by taskId.

const TabStubShell: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  bullets: string[];
}> = ({ icon: Icon, title, description, bullets }) => (
  <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-8 py-10">
    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
      <Icon size={22} className="text-current" />
    </div>
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
      <Sparkles size={10} className="text-current" /> Coming next
    </div>
    <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-2">
      {title}
    </h3>
    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed max-w-sm mb-4">
      {description}
    </p>
    <ul className="space-y-1.5 max-w-sm text-left">
      {bullets.map((b, i) => (
        <li
          key={i}
          className="flex items-start gap-2 text-[11px] font-medium text-muted-foreground/80 leading-relaxed"
        >
          <span className="mt-1 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const FinancialsTabStub: React.FC = () => (
  <TabStubShell
    icon={Calculator}
    title="Financials & Payments"
    description="Track every naira tied to this task — what was budgeted, what's been paid, and what's still outstanding."
    bullets={[
      "Total cost vs total paid vs balance, rolled up live",
      "Link any invoice (BOQ, Procurement, Labour, Variation, Final…) or receipt to this task",
      "Spend timeline so you can see financial damage build up over time",
    ]}
  />
);

const ReportsTabStub: React.FC = () => (
  <TabStubShell
    icon={ScrollText}
    title="Associate Field Reports"
    description="Field reports live in their own module. This tab will surface the ones written about this task — incidents, strategies applied, photos from site."
    bullets={[
      "Search and filter reports tied to this task",
      "Pull in incident tags + strategies so post-mortems are one click away",
      "See assignment history so you know who was on it when each report was filed",
    ]}
  />
);

const MemberSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <UserIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-current" />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background appearance-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);
