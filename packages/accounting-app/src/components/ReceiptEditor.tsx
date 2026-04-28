import React, { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  RefreshCw,
  Check,
  Users,
  Shield,
  Eye,
  Trash2
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import { AnnotationSystem } from "./AnnotationSystem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { type Annotation, type MemberRole, canWrite, DocData, TableRow, InvoiceCode, Contact } from "../types";
import { api } from "../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptPage } from "./ReceiptPage";
import { 
  resolveSectionTotal, 
  resolveSectionTotalBackward, 
  resolveFormula,
  computeTotalPrice,
  getRowNumbering 
} from "../lib/documentUtils";
import { findPriceColumnId } from "../lib/service-dictionary";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, editorStore, connectProject, connectEditor, authProvider } from "../store";
import { getYjsDoc } from "@syncedstore/core";
import { Radio, SignalIcon } from "lucide-react";

const ReceiptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const fromFolder = location.state?.fromFolder;
  const queryClient = useQueryClient();

  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);
  // Real-time collaborative receipt content — shared with every client
  // connected to the `doc-{id}` Hocuspocus room.
  const editorAction = useSyncedStore(editorStore);
  const { user: currentUser, businessId, businessName: ctxBusinessName, projectId } = useAuth();

  const { data: docMetadataRaw, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id && !!currentUser,
  });

  // some drivers/setups might return the JSONB metadata as a string
  const docMetadata = useMemo(() => {
    if (!docMetadataRaw) return null;
    const meta = (docMetadataRaw as any).metadata;
    if (typeof meta === 'string') {
      try {
        return { ...docMetadataRaw, metadata: JSON.parse(meta) };
      } catch (e) {
        console.error("Failed to parse document metadata:", e);
      }
    }
    return docMetadataRaw;
  }, [docMetadataRaw]);

  // Once this receipt loads and it's finalised, default to Preview mode —
  // matching the invoice editor's behavior. Once per doc id; the Preview
  // toggle on the toolbar still works freely after that.
  const primedDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !docMetadata) return;
    if (primedDocIdRef.current === id) return;
    primedDocIdRef.current = id;
    if (docMetadata.status === 'finalised') {
      setIsPreview(true);
    }
  }, [id, docMetadata]);

  // active project resolved from the document's own projectId, or fallback to the one in context
  const resolvedProjectId = (docMetadata as any)?.metadata?.projectId || docMetadata?.projectId || projectId;

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    enabled: !!currentUser,
  });

  const activeProject = useMemo(() => {
    return allProjects.find((p: any) => p.id === resolvedProjectId);
  }, [allProjects, resolvedProjectId]);

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents', resolvedProjectId],
    queryFn: () => api.getDocuments(resolvedProjectId!),
    enabled: !!currentUser && !!resolvedProjectId,
  });

  const availableEmails = useMemo(() => {
    if (!activeProject || !docMetadata) return [];
    const projectMembers = (activeProject.members || []).map(m => (typeof m === 'string' ? m : m.email));
    const docMembers = (docMetadata.members || []).map((m: any) => (typeof m === 'string' ? m : m.email));
    return projectMembers.filter(email => !docMembers.includes(email));
  }, [activeProject, docMetadata]);

  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [myClientId, setMyClientId] = useState<string>("unknown");

  const { data: parentInvoiceData } = useQuery({
    queryKey: ['invoice-management', (docMetadata as any)?.metadata?.invoiceId],
    queryFn: () => api.getInvoiceManagement((docMetadata as any).metadata.invoiceId!),
    enabled: !!(docMetadata as any)?.metadata?.invoiceId,
  });

  const parentInvoiceCode = useMemo(() => {
    if (!parentInvoiceData) return null;
    return parentInvoiceData.draft?.invoiceCode?.text || 
           parentInvoiceData.versions?.[0]?.content?.invoiceCode?.text || "—";
  }, [parentInvoiceData]);

  // Business name comes from AuthContext (reads /api/users/profile).
  // Firestore has been fully deprecated in this codebase.
  const businessName = ctxBusinessName || "Your Business";

  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser || !businessId || !id) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await currentUser.getIdToken();
      // 1. Project room — workspace data & team list
      connectProject(resolvedProjectId!, token, businessId!);
      // 2. Per-document room — real-time receipt content + presence
      const editorProvider = connectEditor(id, token);

      // Per-document presence: only users on THIS receipt show up here.
      const updatePresence = () => {
        const states = editorProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            // Find their persistent role
            const email = state.user.email;
            const member = (docMetadata?.members || []).find((m: any) =>
              (typeof m === 'string' ? m : m.email) === email,
            );
            const role = member ? (typeof member === 'object' ? member.role : 'editor') : (state.user.id === docMetadata?.userId ? 'owner' : 'editor');

            clients.push({ 
              id: clientId.toString(), 
              user: state.user,
              role: role 
            });
          }
        });
        setConnectedClients(clients);
      };

      editorProvider.awareness?.on('change', updatePresence);
      setMyClientId(editorProvider.awareness?.clientID.toString() || "unknown");
      editorProvider.awareness?.setLocalStateField('user', {
        name: currentUser.displayName || "Anonymous",
        email: currentUser.email || "guest@system.com",
        photo: currentUser.photoURL,
        id: currentUser.uid,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        docId: id,
      });

      // Seed the shared content from REST on first open (skipped if another
      // peer already has the doc in memory — we'll get their state via sync).
      const seedIfEmpty = async () => {
        try {
          if (Object.keys(editorStore.content || {}).length > 0) return;
          const all = await api.getDocuments(resolvedProjectId!);
          const found = all.find((d: any) => d.id === id);
          if (found?.content && Object.keys(editorStore.content || {}).length === 0) {
            Object.assign(editorStore.content, found.content);
            console.log('[ReceiptEditor] 📥 Seeded content from REST');
          }
        } catch (e) {
          console.error('[ReceiptEditor] seed from REST failed', e);
        }
      };

      editorProvider.on('synced', seedIfEmpty);
      setTimeout(seedIfEmpty, 600);

      setIsSyncReady(true);
      cleanup = () => {
        editorProvider.awareness?.off('change', updatePresence);
        editorProvider.off('synced', seedIfEmpty);
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId, id, resolvedProjectId]);

  // Live "is this doc currently editable?" flag for the auto-save listener.
  // We mirror the live value into a ref so the bound listener's closure
  // always sees the latest decision — without this, the listener captures
  // a stale value and keeps trying to save against a now-locked doc, which
  // the backend rejects with 403.
  const canAutoSaveRef = useRef(true);

  // --- Collaborative auto-save ---------------------------------------------
  // Any Yjs update on the editor doc schedules a debounced REST save.
  useEffect(() => {
    if (!id || !isSyncReady) return;
    const yDoc = getYjsDoc(editorStore);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSave = () => {
      if (!canAutoSaveRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!canAutoSaveRef.current) return;
        try {
          if (!editorStore.content || Object.keys(editorStore.content).length === 0) return;
          const snapshot = JSON.parse(JSON.stringify(editorStore.content));
          api.updateDocument(id, snapshot).catch(err =>
            console.warn('[ReceiptEditor] auto-save failed:', err)
          );
        } catch (e) {
          console.error('[ReceiptEditor] failed to snapshot content for auto-save', e);
        }
      }, 2000);
    };

    yDoc.on('update', scheduleSave);
    return () => {
      yDoc.off('update', scheduleSave);
      if (timer) clearTimeout(timer);
    };
  }, [id, isSyncReady]);

  // `docData` is the real-time collaborative proxy — mutations broadcast to
  // every peer on this receipt via Yjs.
  const docData = (
    editorAction.content && Object.keys(editorAction.content).length > 0
      ? (editorAction.content as any)
      : undefined
  );

  // parent invoice for the breadcrumb — read from the parentInvoiceData query
  // so it's reliable and handles IDs across the documents/invoices tables.
  const parentInvoiceRef = parentInvoiceCode;

  const isLoadingDoc = isLoadingMetadata || !docMetadata;
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );

  // Resolved user role and editability
  const userRole = React.useMemo<MemberRole>(() => {
    if (!currentUser?.email) return 'viewer';
    if (docMetadata?.isOwner) return 'owner';
    const activeProject = workspaceAction.projects?.find((p: any) => p.id === projectId);
    if (activeProject?.myRole) return activeProject.myRole as MemberRole;
    const member = (docMetadata?.members || []).find((m: any) =>
      (typeof m === 'string' ? m : m.email) === currentUser.email,
    );
    if (member) return (typeof member === 'object' ? member.role : 'editor') as MemberRole;
    return 'viewer';
  }, [docMetadata, currentUser?.email, workspaceAction.projects, projectId]);

  const isReadOnly = React.useMemo(() => {
    if (docMetadata?.status === 'finalised' || docMetadata?.status === 'voided') return true;
    return !canWrite(userRole);
  }, [userRole, docMetadata?.status]);

  // Keep the auto-save ref in lockstep with the latest editability decision.
  // This is what the bound Yjs listener reads at fire-time, so any change to
  // isReadOnly / isPreview / status takes effect immediately (no stale closure).
  useEffect(() => {
    canAutoSaveRef.current = !(isReadOnly || isPreview ||
      docMetadata?.status === 'finalised' ||
      docMetadata?.status === 'voided');
  });

  // Annotation state persisted in REST metadata
  const annotations = React.useMemo(() => {
    return docMetadata?.metadata?.annotations || [];
  }, [docMetadata?.metadata?.annotations]);

  const handleSaveAnnotations = async (next: Annotation[]) => {
    if (isReadOnly) return;
    if (!docMetadata || !docData) return;
    const updatedMetadata = {
      ...(docMetadata.metadata || {}),
      annotations: next
    };
    // Optimistic update
    docMetadata.metadata = updatedMetadata;
    // Persist via API
    await api.updateDocument(docMetadata.id, docData, updatedMetadata);
    queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
  };

  // --- Auto-fill financial metadata from Parent Invoice ---
  useEffect(() => {
    if (isSyncReady && docData && parentInvoiceData && docMetadata?.status === 'draft') {
      // Only auto-fill if these fields are essentially empty/unset
      if (!docData.totalInvoiceAmount || docData.totalInvoiceAmount === 0) {
        docData.totalInvoiceAmount = parentInvoiceData.grandTotal;
      }

      if (!docData.table.columns || docData.table.columns.length === 0) {
        docData.table.columns = [
          { id: "A", label: "S/N",         type: "index",  width: "50px" },
          { id: "B", label: "Description", type: "text"                  },
          { id: "C", label: "Amount (₦)",  type: "number", width: "160px" },
        ];
      }
      
      if (!docData.contact?.name && parentInvoiceData.name) {
        if (!docData.contact) docData.contact = { name: "", address1: "", address2: "" };
        docData.contact.name = parentInvoiceData.name;
        // Try to pull contact details from the invoice's own content if available
        const invContent = parentInvoiceData.draft || parentInvoiceData.versions?.[0]?.content;
        if (invContent?.contact) {
          docData.contact.address1 = invContent.contact.address1 || "";
          docData.contact.address2 = invContent.contact.address2 || "";
        }
      }

      if (!docData.amountPaid || docData.amountPaid === 0) {
        const amt = parentInvoiceData.outstanding;
        docData.amountPaid = amt;
        
        // Sync with table row so backend sees the total
        if (docData.table && docData.table.rows && docData.table.rows.length > 0) {
           const firstRow = docData.table.rows[0];
           if (firstRow) firstRow.C = amt;
        } else if (docData.table) {
           docData.table.rows.push({
             id: 'r-auto-1',
             rowType: 'row',
             B: 'Payment for referenced invoice',
             C: amt
           });
        }
      }

      // Default reference if empty
      if (!docData.reference && parentInvoiceCode) {
        docData.reference = `Ref: ${parentInvoiceCode}`;
      }
    }
  }, [isSyncReady, docData, parentInvoiceData, docMetadata?.status, parentInvoiceCode]);

  const [headerImage, setHeaderImage] = useState<string>(
    () => localStorage.getItem("receiptHeaderImage") || "/Shan-PaymentReceipt.png",
  );
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    localStorage.setItem("receiptHeaderImage", headerImage);
  }, [headerImage]);

  useEffect(() => {
    if (docData) {
      const receiptNo = docData.invoiceCode?.text || "Receipt";
      const clientName = docData.contact?.name || "Client";
      document.title = `${receiptNo} - ${clientName}`;

      // Auto-sync reference from parent invoice if missing/empty
      if (parentInvoiceRef && (!docData.reference || docData.reference === "--") && !isReadOnly) {
        docData.reference = parentInvoiceRef;
      }
    }
  }, [docData, parentInvoiceRef, isReadOnly]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // --- Real-time content management ---
  useEffect(() => {
    if (!id || !docData) return;
  }, [docData, id]);

  const onUpdateCell = (
    rowId: string,
    colId: string,
    value: string | number | boolean,
  ) => {
    if (!docData) return;
    const row = docData.table.rows.find((r: any) => r.id === rowId);
    if (!row) return;

    const column = docData.table.columns.find((c: any) => c.id === colId);
    if (column?.type === "number") {
      const parsed = parseFloat(value as string);
      row[colId] = isNaN(parsed) ? 0 : parsed;
    } else {
      row[colId] = value;
    }
  };

  const updateDocData = (
    newData: DocData | ((prev: DocData | null) => DocData | null),
  ) => {
    // Collaborative source of truth: editorStore.content.
    if (!editorStore.content) return;
    const next = typeof newData === "function" ? newData(docData as any) : newData;
    if (!next) return;
    const currentKeys = Object.keys(editorStore.content);
    const nextKeys = new Set(Object.keys(next));
    for (const k of currentKeys) {
      if (!nextKeys.has(k)) delete (editorStore.content as any)[k];
    }
    Object.assign(editorStore.content, next);
  };

  const onRemoveRow = (targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i !== -1) docData.table.rows.splice(i, 1);
    }
  };

  const onAddRowBelow = (targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      // Build the new row from the actual column schema so it works across
      // every template, not just the default B/C/D layout.
      const newRow: any = { id: crypto.randomUUID(), rowType: "row" };
      (docData.table.columns || []).forEach((col: any) => {
        if (col.type === "index") return;
        newRow[col.id] = col.type === "number" ? 0 : "";
      });
      docData.table.rows.splice(i + 1, 0, newRow);
    }
  };

  const email = currentUser?.email || "";
  const isProjectMember = workspaceAction.projects?.some(
    (p: any) => p.id === (docMetadata?.projectId || projectId) && 
      (p.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email)
  );
  const isMember = isProjectMember || (docMetadata && 
    (docMetadata.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email)
  );

  const useSections = docData?.useSections ?? false;

  const rowNumbering = React.useMemo(
    () => getRowNumbering(docData?.table.rows || [], useSections),
    [docData?.table.rows, useSections],
  );

  // Only gate on metadata + sync. If the collaborative `docData` is still empty
  // after sync we render an empty editor rather than hanging — this can happen
  // right after a brand-new receipt is created and no peer has any state yet.
  if (isLoadingDoc || !isSyncReady)
    return (
      <div className="flex items-center justify-center h-screen bg-background text-primary">
        <RefreshCw className="animate-spin" size={32} />
      </div>
    );

  if (!docData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-muted-foreground gap-3">
        <RefreshCw className="animate-spin" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest">Waiting for receipt content…</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-border rounded-lg hover:bg-muted"
        >
          Reload
        </button>
      </div>
    );
  }

  // Removed Access Denied guard to restore editability

  const { subTotal, summaries, grandTotal } = 
    docData ? computeTotalPrice(docData) : { subTotal: 0, summaries: [], grandTotal: 0 };

  const summaryForRender = summaries;


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && docData) {
      const oldIndex = docData.table.rows.findIndex((r: any) => r.id === active.id);
      const newIndex = docData.table.rows.findIndex((r: any) => r.id === over.id);
      // Mutate the SyncedStore Yjs proxy directly so the reorder is tracked and
      // broadcast to every connected peer — arrayMove + Object.assign would
      // replace the whole array reference and bypass Yjs change tracking.
      if (oldIndex !== -1 && newIndex !== -1) {
        const item = docData.table.rows[oldIndex];
        docData.table.rows.splice(oldIndex, 1);
        docData.table.rows.splice(newIndex, 0, item);
      }
    }
  };

  const handleHeaderResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = headerHeight;
    const handleMouseMove = (em: MouseEvent) => {
      const newHeight = startHeight + (em.clientY - startY);
      setHeaderHeight(Math.max(50, newHeight));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const pages = [{ rows: docData.table.rows, isFirstPage: true, showRows: true, showTotals: true, showFooter: true, isEndOfRows: true }];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden font-sans transition-colors duration-300">
      {/* ── Sticky Workspace Header ── */}
      <header className="h-14 border-b border-border bg-card flex items-center gap-2 px-6 shrink-0 shadow-sm z-30 transition-colors duration-300 no-print">
        <button
          onClick={() => {
            const invId = (docMetadata as any)?.invoiceId || (docMetadata as any)?.metadata?.invoiceId;
            if (invId) {
              // Forward fromFolder so the invoice page's back-arrow can in
              // turn return to the user's original folder, not the dashboard.
              navigate(`/invoice/${invId}`, { state: { fromFolder } });
            } else {
              navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : "/dashboard");
            }
          }}
          className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground transition-all active:scale-90"
          title="Back to Invoice"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-px h-6 bg-border/40 mx-2" />
        <div className="flex flex-col">
          <h2 className="text-xs font-bold text-foreground">Receipt Editor</h2>
          <div className="flex items-center gap-1.5 opacity-60">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
              {docMetadata?.name || "Untitled"}
            </p>
            {parentInvoiceRef && (
              <>
                <span className="text-muted-foreground/30 text-[10px]">/</span>
                <span className="text-[10px] text-primary/60 uppercase tracking-widest font-black">
                  Ref: {parentInvoiceRef}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {/* Status Indicator — only relevant while editing is possible */}
          {docMetadata?.status !== 'finalised' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
              <RefreshCw size={10} className="text-success animate-spin-slow" />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auto Saved</span>
            </div>
          )}

          <button
             onClick={() => setIsCollaboratorsOpen(true)}
             className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest shadow-sm relative group"
          >
             <Users size={12} />
             {connectedClients.length > 1 && (
               <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-card" />
             )}
             Collabs
          </button>

          <div className="h-6 w-px bg-border/40 mx-1" />



          <button
            onClick={() => window.print()}
            className="p-1.5 bg-muted text-muted-foreground border border-border rounded-lg transition-all shadow-sm hover:bg-muted/80 active:scale-95 no-print"
            title="Print (Browser)"
          >
            <Printer size={16} />
          </button>
          {docMetadata?.status === 'draft' && (
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to delete this draft receipt?")) return;
                try {
                  await api.deleteReceipt(id!);
                  const invId = (docMetadata as any)?.invoiceId || (docMetadata as any)?.metadata?.invoiceId;
                  navigate(invId ? `/invoice/${invId}` : `/dashboard`);
                } catch (e) {
                  alert("Deletion failed");
                }
              }}
              className="p-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 active:scale-95 transition-all shadow-sm"
              title="Delete Draft"
            >
              <Trash2 size={16} />
            </button>
          )}

          {docMetadata?.status !== 'finalised' && docMetadata?.status !== 'voided' && (
            <button
              onClick={async () => {
                const confirm = window.confirm("Finalising this receipt will freeze it, add it to the payment chain, and LOCK the parent invoice — no further edits to the invoice itself will be allowed. Proceed?");
                if (!confirm) return;
                try {
                  await api.finaliseReceipt(id!);
                  // Refetch — docMetadata.status flips to 'finalised', which
                  // hides this button, shows Close, primes Preview mode, and
                  // gates the auto-save listener. No inline PDF view here.
                  queryClient.invalidateQueries({ queryKey: ['document', id] });
                  const invId = (docMetadata as any)?.invoiceId || (docMetadata as any)?.metadata?.invoiceId;
                  if (invId) queryClient.invalidateQueries({ queryKey: ['invoice-management', invId] });
                } catch (e) {
                  alert("Finalization failed");
                }
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-success text-success-foreground rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 active:scale-95"
            >
              <Check size={14} /> Finalize Receipt
            </button>
          )}

          {docMetadata?.status === 'finalised' && (
            <button
              onClick={() => {
                const invId = (docMetadata as any)?.invoiceId || (docMetadata as any)?.metadata?.invoiceId;
                if (invId) {
                  navigate(`/invoice/${invId}`, { state: { fromFolder } });
                } else {
                  navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : '/dashboard');
                }
              }}
              className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-all text-[10px] font-black uppercase tracking-widest border border-border"
            >
              Close
            </button>
          )}
        </div>
      </header>

      {isReadOnly && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-warning">
          <Eye size={12} /> View-only — your role ({userRole}) cannot edit this document
        </div>
      )}

      <div className="preview-container flex-1 overflow-y-auto flex flex-col items-center print:bg-white print:p-0 print:overflow-visible print:h-auto custom-scrollbar bg-slate-100/50 p-6 lg:p-16">
          <div ref={containerRef} className="relative w-fit flex flex-col items-center">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={(docData?.table.rows || []).map((r: any) => r.id as string)} strategy={verticalListSortingStrategy}>
            {pages.map((page, idx) => (
              <ReceiptPage
                key={idx}
                {...page}
                data={docData}
              pageIndex={idx}
              totalPrice={{ subTotal, summaries: summaryForRender, grandTotal }}
              rowNumbering={rowNumbering}
              headerImage={headerImage}
              headerHeight={headerHeight}
              onHeaderResize={handleHeaderResize}
              onHeaderImageUpload={setHeaderImage}
              isLastPage={idx === pages.length - 1}
              startIndex={0}
              onUpdateContact={(field, val) => { if (docData) docData.contact[field as keyof Contact] = val as string; }}
              onUpdateTitle={(val) => { if (docData) docData.title = val; }}
              onUpdateCell={onUpdateCell}
              onRemoveRow={onRemoveRow}
              onAddRowBelow={onAddRowBelow}
              onAddRowAbove={() => {}}
              onAddSectionBelow={() => {}}
              onAddSectionAbove={() => {}}
              onAddSubSectionBelow={() => {}}
              onAddSubSectionAbove={() => {}}
              onMoveRow={() => {}}
              useSections={useSections}
              resolveFormula={resolveFormula}
              resolveSectionTotalBackward={(rows, idx) => resolveSectionTotalBackward(rows, idx, docData!)}
              resolveSectionTotal={(rows, idx) => resolveSectionTotal(rows, idx, docData!)}
              onUpdateInvoiceCode={(upd) => {
                if (docData) {
                  if (!docData.invoiceCode) {
                    docData.invoiceCode = {
                      text: "",
                      prefix: "REC",
                      company: "IP",
                      count: "0001",
                      year: String(new Date().getFullYear()),
                      x: 600,
                      y: 100,
                      color: "#503D36",
                    } as any;
                  }
                  
                  // If we are updating the full text, try to explode it into parts 
                  // to keep the structured fields in sync.
                  if (upd.text) {
                    const parts = upd.text.split("/");
                    if (parts.length === 4) {
                      docData.invoiceCode.prefix = parts[0];
                      docData.invoiceCode.company = parts[1];
                      docData.invoiceCode.count = parts[2];
                      docData.invoiceCode.year = parts[3];
                    }
                  }

                  Object.assign(docData.invoiceCode, upd);
                  
                  // Sync formatting: only re-apply formatting if we HAVE the parts, 
                  // otherwise respect the raw text provided.
                  const ic = docData.invoiceCode!;
                  ic.text = ic.text || `${ic.prefix || "REC"}/${ic.company || "IP"}/${ic.count || "0001"}/${ic.year || new Date().getFullYear()}`;
                }
              }}
              onUpdateSummaryItem={() => {}}
              onUpdateDate={(val) => { if (docData) docData.date = val; }}
              onUpdatePaymentMethod={(val) => { if (docData) docData.paymentMethod = val; }}
              onUpdateSignature={(val) => { if (docData) docData.signature = val; }}
              onUpdateReceiptMessage={(val) => { if (docData) docData.receiptMessage = val; }}
              onUpdateTransactionId={(val) => { if (docData) docData.transactionId = val; }}
              onUpdateReference={(val) => { if (docData) docData.reference = val; }}
              onUpdateTotalInvoiceAmount={(val) => { if (docData) docData.totalInvoiceAmount = Number(val); }}
              onUpdateAmountPaid={(val) => { 
                if (docData) {
                  const numVal = Number(val);
                  docData.amountPaid = numVal;
                  const priceColId = findPriceColumnId(docData.table.columns) || 'C';
                  if (docData.table && docData.table.rows && docData.table.rows.length > 0) {
                    const firstRow = docData.table.rows[0];
                    if (firstRow) firstRow[priceColId] = numVal;
                  } else if (docData.table) {
                    docData.table.rows.push({
                      id: 'r-manual-1',
                      rowType: 'row',
                      B: 'Payment for referenced invoice',
                      [priceColId]: numVal
                    });
                  }
                } 
              }}
              onUpdateOutstandingBalance={(val) => { if (docData) docData.outstandingBalance = Number(val); }}
              onUpdateAcknowledgement={(val) => { if (docData) docData.acknowledgement = val; }}
              isPreview={isReadOnly || isPreview}
              showRows={false}
              showTotals={false}
              showFooter={true}
              isEndOfRows={true}
            />
          ))}
          </SortableContext>
        </DndContext>
        <AnnotationSystem
            annotations={annotations}
            onSave={handleSaveAnnotations}
            containerRef={containerRef}
            mediaType="document"
            isReadOnly={isReadOnly}
            userRole={userRole}
        />
          </div>
      </div>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0 !important;
          }
          html, body { 
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
          }
          .no-print { display: none !important; }
          .app-root, .app-main, .preview-container { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          .a4-page {
            margin: 0 auto !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .a4-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>
      {/* Collaborators Sheet */}
      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients}
        ownerId={(docMetadata as any)?.metadata?.userId || (docMetadata as any)?.userId || authAction.governance.ownerId || null}
        businessId={businessId}
        businessName={businessName}
        initialTab={activeCollaboratorTab}
        bannedClients={authAction.bannedClients}
        onBanClient={(email) => {
          if (!authAction.bannedClients.includes(email)) {
            authAction.bannedClients.push(email);
          }
        }}
        onUpdateRole={async (email, role) => {
          try {
            await api.updateMemberRole('document', id!, email, role);
            queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
          } catch (e: any) {
            alert(e.message || "Failed to update role");
          }
        }}
        onAddMember={async (email) => {
          if (!projectId) return;
          await api.addProjectMember(projectId, email, 'viewer');
          queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
        }}
        availableEmails={availableEmails}
      />
    </div>
  );
};

export default ReceiptEditor;
