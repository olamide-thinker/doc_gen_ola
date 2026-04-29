import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  User as UserIcon,
  Check,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

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
}

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** When set, the modal opens in edit mode for this task. */
  editing?: TaskRecord | null;
  /** Called after a successful create or update with the resulting record. */
  onSaved?: (task: TaskRecord) => void;
  /** List of project members for assignee/supervisor pickers. */
  members?: Array<{ email: string; userId?: string; role?: string }>;
}

const STATUSES: TaskStatus[] = ["pending", "progress", "done", "cancelled"];
const PRIORITIES: TaskPriority[] = ["low", "med", "high"];

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

  // Reset form when (re)opened or when target changes
  useEffect(() => {
    if (!open) return;
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
      setTitle("");
      setDetails("");
      setStatus("pending");
      setPriority("med");
      setDeadlineLocal("");
      setSupervisorId("");
      setAssigneeId("");
      setBudget("");
      setLocationType(null);
      setLocationText("");
      setMaterials([]);
    }
  }, [open, editing?.id]);

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

    try {
      const result = editing
        ? await api.updateTask(editing.id, payload)
        : await api.createTask(payload);
      onSaved?.(result as TaskRecord);
      onClose();
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
              <div className="min-w-0">
                <h2 className="text-sm font-black uppercase tracking-widest">
                  {editing ? `Edit ${editing.taskCode}` : "New Task"}
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {editing ? "Update fields and save" : "Code is generated on save"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
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
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all"
              >
                <Check size={12} /> {saving ? "Saving..." : editing ? "Save changes" : "Create task"}
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
