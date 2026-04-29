import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Send,
  Check,
  Ban,
  Clock,
  CheckCircle2,
  ScrollText,
  AlertTriangle,
  Sparkles,
  User as UserIcon,
  Trash2,
  MessageSquare,
  Boxes,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Kind = "note" | "incident" | "update" | "confirmation_request" | "material_request";

interface ReportDetailModalProps {
  reportId: string;
  projectId: string;
  tasks: Array<{ id: string; taskCode: string; title: string; status: string }>;
  onClose: () => void;
  /**
   * Called when something inside the modal changes that the parent might
   * care about (resolution, new message, deletion). The parent typically
   * invalidates its react-query cache.
   */
  onChanged?: () => void;
}

const KIND_META: Record<Kind, { label: string; icon: React.ComponentType<any>; tint: string }> = {
  note: { label: "Note", icon: ScrollText, tint: "bg-blue-500/10 text-blue-500" },
  incident: { label: "Incident", icon: AlertTriangle, tint: "bg-red-500/10 text-red-500" },
  update: { label: "Update", icon: Sparkles, tint: "bg-amber-500/10 text-amber-600" },
  confirmation_request: {
    label: "Request",
    icon: CheckCircle2,
    tint: "bg-emerald-500/10 text-emerald-600",
  },
  material_request: {
    label: "Material Request",
    icon: Boxes,
    tint: "bg-violet-500/10 text-violet-600",
  },
};

const TASK_STATUS_TINT: Record<string, string> = {
  pending: "bg-red-500/10 text-red-500",
  progress: "bg-amber-500/10 text-amber-500",
  done: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const fmtRelative = (iso?: string | null) => {
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
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
};

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  reportId,
  projectId,
  tasks,
  onClose,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: report, isLoading } = useQuery({
    queryKey: ["field-report", reportId],
    queryFn: () => api.getFieldReport(reportId),
    enabled: !!reportId,
  });

  // Thread is queried separately so posting a message can refresh just the
  // thread without re-pulling the whole report.
  const { data: messages = [] } = useQuery({
    queryKey: ["field-report-messages", reportId],
    queryFn: () => api.listReportMessages(reportId),
    enabled: !!reportId,
  });

  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [resolveBusy, setResolveBusy] = useState<"accept" | "decline" | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    setReply("");
    setResolveNote("");
  }, [reportId]);

  const subjectTask = useMemo(
    () => tasks.find((t) => t.id === report?.taskId),
    [tasks, report?.taskId],
  );
  const requestTask = useMemo(
    () => tasks.find((t) => t.id === report?.request?.targetTaskId),
    [tasks, report?.request?.targetTaskId],
  );

  const meta = report ? KIND_META[report.kind as Kind] || KIND_META.note : KIND_META.note;
  const ResolutionStatus = report?.resolution?.status as
    | "accepted"
    | "fulfilled"
    | "declined"
    | undefined;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["field-report", reportId] });
    queryClient.invalidateQueries({ queryKey: ["field-report-messages", reportId] });
    onChanged?.();
  };

  const handlePostReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setPosting(true);
    try {
      await api.postReportMessage(reportId, { body: text });
      setReply("");
      refreshAll();
    } catch (e: any) {
      alert(e?.message || "Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this reply?")) return;
    try {
      await api.deleteReportMessage(reportId, messageId);
      refreshAll();
    } catch (e: any) {
      alert(e?.message || "Failed to delete reply");
    }
  };

  const handleResolve = async (action: "accept" | "decline") => {
    if (action === "accept") {
      let msg: string;
      if (report?.kind === "material_request") {
        const itemCount = report?.request?.items?.length || 0;
        msg = `Mark this material request as fulfilled? ${itemCount} item${itemCount === 1 ? "" : "s"} will be flagged as supplied.`;
      } else {
        const targetCode = requestTask?.taskCode || "this task";
        const newStatus = report?.request?.requestedStatus;
        msg = `Accept this request? ${targetCode} will be set to "${newStatus}".`;
      }
      if (!confirm(msg)) return;
    }
    setResolveBusy(action);
    try {
      await api.resolveFieldReport(reportId, action, resolveNote.trim() || undefined);
      setResolveNote("");
      refreshAll();
    } catch (e: any) {
      alert(e?.message || "Failed to resolve");
    } finally {
      setResolveBusy(null);
    }
  };

  const Icon = meta.icon;

  return (
    <AnimatePresence>
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
          className="w-full max-w-5xl h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {report && (
                <span className="text-[10px] font-mono font-black px-2 py-1 bg-muted text-muted-foreground rounded-md shrink-0 tracking-tight">
                  {report.reportCode}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-black uppercase tracking-widest">Report</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                  {report?.title || (report?.body || "").split("\n")[0] || "—"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              title="Close"
            >
              <X size={16} className="text-current" />
            </button>
          </div>

          {/* Two-column body */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_minmax(360px,420px)] divide-x divide-border min-h-0">
            {/* Left — report content */}
            <div className="overflow-y-auto custom-scrollbar p-6 space-y-5">
              {isLoading || !report ? (
                <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
                  Loading…
                </div>
              ) : (
                <>
                  {/* Author + meta block */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0">
                      <UserIcon size={16} className="text-muted-foreground/70 text-current" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black truncate">
                          {report.author?.fullName || report.author?.email || report.authorId || "Unknown"}
                        </span>
                        <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0", meta.tint)}>
                          <Icon size={9} className="inline mr-1 -mt-0.5 text-current" />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                        {fmtRelative(report.createdAt)} · {fmtDateTime(report.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Subject task ref */}
                  {subjectTask && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Ref:
                      </span>
                      <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-card border border-border rounded text-foreground shrink-0">
                        {subjectTask.taskCode}
                      </span>
                      <span className="text-[12px] font-bold truncate flex-1">
                        {subjectTask.title}
                      </span>
                      <span
                        className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                          TASK_STATUS_TINT[subjectTask.status] || TASK_STATUS_TINT.pending,
                        )}
                      >
                        {subjectTask.status}
                      </span>
                    </div>
                  )}

                  {/* Confirmation-request panel */}
                  {report.kind === "confirmation_request" && report.request && (
                    <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 text-current" />
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                            Status change request
                          </h4>
                        </div>
                        {ResolutionStatus ? (
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                              ResolutionStatus === "accepted"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-red-500/10 text-red-500",
                            )}
                          >
                            {ResolutionStatus === "accepted" ? (
                              <Check size={9} className="text-current" />
                            ) : (
                              <Ban size={9} className="text-current" />
                            )}
                            {ResolutionStatus}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 inline-flex items-center gap-1">
                            <Clock size={9} className="text-current" /> Awaiting
                          </span>
                        )}
                      </div>

                      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-muted/60 rounded shrink-0">
                          {requestTask?.taskCode || "—"}
                        </span>
                        <span className="text-xs font-bold flex-1 truncate">
                          {requestTask?.title || "Task not found"}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          → set to
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                            TASK_STATUS_TINT[report.request.requestedStatus] ||
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {report.request.requestedStatus}
                        </span>
                      </div>

                      {report.request.note && (
                        <p className="text-[11px] italic text-muted-foreground leading-relaxed">
                          “{report.request.note}”
                        </p>
                      )}

                      {/* Resolve actions — only if pending and viewer is not author */}
                      {!ResolutionStatus && (
                        <div className="space-y-2 pt-2 border-t border-emerald-500/20">
                          {report.authorId === user?.uid ? (
                            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest text-center">
                              Awaiting a reviewer's decision
                            </p>
                          ) : (
                            <>
                              <input
                                value={resolveNote}
                                onChange={(e) => setResolveNote(e.target.value)}
                                placeholder="Optional note for the requester…"
                                className="w-full px-3 py-1.5 bg-card border border-border rounded-md text-[11px] focus:outline-none focus:border-foreground"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResolve("accept")}
                                  disabled={resolveBusy !== null}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
                                >
                                  <Check size={11} className="text-current" />
                                  {resolveBusy === "accept" ? "Applying…" : "Accept & apply"}
                                </button>
                                <button
                                  onClick={() => handleResolve("decline")}
                                  disabled={resolveBusy !== null}
                                  className="px-3 py-2 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
                                >
                                  Decline
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {ResolutionStatus && (
                        <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-emerald-500/20">
                          <div>
                            <span className="font-black uppercase tracking-widest opacity-70">
                              Resolved by:
                            </span>{" "}
                            {report.resolution?.resolvedBy?.fullName ||
                              report.resolution?.resolvedBy?.email ||
                              report.resolution?.resolvedById ||
                              "—"}
                          </div>
                          {report.resolution?.resolvedAt && (
                            <div>
                              <span className="font-black uppercase tracking-widest opacity-70">
                                When:
                              </span>{" "}
                              {fmtDateTime(report.resolution.resolvedAt)}
                            </div>
                          )}
                          {report.resolution?.note && (
                            <div className="italic mt-1.5">
                              “{report.resolution.note}”
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Material-request panel */}
                  {report.kind === "material_request" && report.request && (
                    <div className="border border-violet-500/30 bg-violet-500/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Boxes size={14} className="text-violet-600 text-current" />
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-400">
                            Items requested
                          </h4>
                        </div>
                        {ResolutionStatus ? (
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                              ResolutionStatus === "fulfilled"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-red-500/10 text-red-500",
                            )}
                          >
                            {ResolutionStatus === "fulfilled" ? (
                              <Check size={9} className="text-current" />
                            ) : (
                              <Ban size={9} className="text-current" />
                            )}
                            {ResolutionStatus}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 inline-flex items-center gap-1">
                            <Clock size={9} className="text-current" /> Awaiting
                          </span>
                        )}
                      </div>

                      {/* Items table — bag, ton, m, etc. Each row shows the
                          requested quantity + unit, with a small "catalog"
                          pill when soft-linked to inventory. */}
                      <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
                        {(report.request.items || []).map((it: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                          >
                            <span className="font-bold truncate flex-1 inline-flex items-center gap-1.5">
                              {it.name}
                              {it.inventoryItemId && (
                                <span
                                  className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 shrink-0"
                                  title="Linked to your inventory catalog"
                                >
                                  catalog
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px] tabular-nums shrink-0">
                              {it.quantity}
                              {it.unit ? ` ${it.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>

                      {report.request.note && (
                        <p className="text-[11px] italic text-muted-foreground leading-relaxed">
                          “{report.request.note}”
                        </p>
                      )}

                      {/* Resolve actions — only if pending and viewer is not author */}
                      {!ResolutionStatus && (
                        <div className="space-y-2 pt-2 border-t border-violet-500/20">
                          {report.authorId === user?.uid ? (
                            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest text-center">
                              Awaiting a supervisor's decision
                            </p>
                          ) : (
                            <>
                              <input
                                value={resolveNote}
                                onChange={(e) => setResolveNote(e.target.value)}
                                placeholder="Optional note for the requester…"
                                className="w-full px-3 py-1.5 bg-card border border-border rounded-md text-[11px] focus:outline-none focus:border-foreground"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResolve("accept")}
                                  disabled={resolveBusy !== null}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
                                >
                                  <Check size={11} className="text-current" />
                                  {resolveBusy === "accept" ? "Marking…" : "Mark fulfilled"}
                                </button>
                                <button
                                  onClick={() => handleResolve("decline")}
                                  disabled={resolveBusy !== null}
                                  className="px-3 py-2 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
                                >
                                  Decline
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {ResolutionStatus && (
                        <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-violet-500/20">
                          <div>
                            <span className="font-black uppercase tracking-widest opacity-70">
                              Resolved by:
                            </span>{" "}
                            {report.resolution?.resolvedBy?.fullName ||
                              report.resolution?.resolvedBy?.email ||
                              report.resolution?.resolvedById ||
                              "—"}
                          </div>
                          {report.resolution?.resolvedAt && (
                            <div>
                              <span className="font-black uppercase tracking-widest opacity-70">
                                When:
                              </span>{" "}
                              {fmtDateTime(report.resolution.resolvedAt)}
                            </div>
                          )}
                          {report.resolution?.note && (
                            <div className="italic mt-1.5">
                              “{report.resolution.note}”
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {report.body}
                  </div>

                  {/* Attachments — V1 just shows links / thumbnails. */}
                  {Array.isArray(report.attachments) && report.attachments.length > 0 && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
                        Attachments
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {report.attachments.map((a: any, i: number) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-muted/30 border border-border/50 rounded-lg overflow-hidden aspect-square hover:border-primary/30 transition-all"
                          >
                            {a.type === "image" ? (
                              <img
                                src={a.url}
                                alt={a.label || "attachment"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/60 text-[10px] font-bold uppercase tracking-widest">
                                {a.label || a.type || "file"}
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right — thread */}
            <aside className="flex flex-col min-h-0 bg-muted/5">
              <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-1.5">
                  <MessageSquare size={11} className="text-current" /> Thread
                </h3>
                <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums">
                  {messages.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 py-8 italic">
                    No replies yet — start the conversation
                  </div>
                ) : (
                  messages.map((m: any) => (
                    <div
                      key={m.id}
                      className="group flex items-start gap-2.5 p-2.5 bg-card border border-border/50 rounded-lg"
                    >
                      <div className="w-7 h-7 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0">
                        <UserIcon size={11} className="text-muted-foreground/70 text-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black truncate">
                            {m.author?.fullName || m.author?.email || m.authorId || "Unknown"}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            {fmtRelative(m.createdAt)}
                          </span>
                        </div>
                        {m.body && (
                          <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-0.5">
                            {m.body}
                          </p>
                        )}
                        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {m.attachments.map((a: any, i: number) => (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-muted/40 border border-border/50 rounded-md overflow-hidden aspect-video"
                              >
                                {a.type === "image" ? (
                                  <img
                                    src={a.url}
                                    alt={a.label || "attachment"}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/60 text-[9px] font-bold">
                                    {a.label || a.type}
                                  </div>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {m.authorId === user?.uid && (
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                          title="Delete reply"
                        >
                          <Trash2 size={10} className="text-current" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Composer — text-only in V1. Voice + media coming with the
                  upload pipeline integration. */}
              <div className="border-t border-border shrink-0 p-3 bg-card">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handlePostReply();
                    }
                  }}
                  placeholder="Reply…"
                  rows={2}
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-[12px] leading-relaxed focus:outline-none focus:border-foreground/40 focus:bg-background resize-none"
                />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Ctrl+Enter to send
                  </span>
                  <button
                    onClick={handlePostReply}
                    disabled={!reply.trim() || posting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Send size={10} className="text-current" />
                    {posting ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
