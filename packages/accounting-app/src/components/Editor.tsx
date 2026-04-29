import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Printer,
  FileText,
  Upload,
  RefreshCw,
  User,
  Plus,
  Trash2,
  ArrowLeft,
  Layout,
  ChevronUp,
  ChevronDown,
  Download,
  Share,
  Undo2,
  Redo2,
  AlertTriangle,
  Users,
  Shield,
  GripVertical,
  Edit,
  MoreVertical,
  Table,
  Type,
  Sun,
  Moon,
  Check,
  Eye,
  Sparkles,
  BookOpen,
  Boxes,
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import { PdfViewer } from "./PdfViewer";
import { AnnotationSystem } from "./AnnotationSystem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Editable } from "./Editable";
import { arrayMove } from "@dnd-kit/sortable";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DocData, TableRow, Contact, TotalPrice, InvoiceCode } from "../types";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, editorStore, connectProject, connectEditor, authProvider } from "../store";
import { getYjsDoc } from "@syncedstore/core";
import { EditTemplateModal } from "./EditTemplateModal";
import {
  resolveFormula,
  computeTotalPrice,
  getRowNumbering,
  calculateChunks,
  USABLE_HEIGHT,
  resolveSectionTotalBackward,
  resolveSectionTotal
} from "../lib/documentUtils";
import { 
  serviceDictionary, 
  isDescriptionColumn, 
  findPriceColumnId, 
  findUnitColumnId 
} from "../lib/service-dictionary";

import { A4PageProps } from "./A4PageProps";
import { InventoryRowInsertModal, InventoryPick } from "./InventoryRowInsertModal";
import { Annotation, DocumentMember, MemberRole, canWrite } from "../types";
import { Radio, SignalIcon } from "lucide-react";
import { API_BASE } from "../lib/workspace-persist";

const SortableSummaryItem = ({
  item,
  idx,
  onUpdate,
  onRemove,
  calculatedValue,
}: {
  item: any;
  idx: number;
  onUpdate: (updates: any) => void;
  onRemove: () => void;
  calculatedValue: number;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };
  const letterId = String.fromCharCode(65 + idx);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col items-center gap-2 p-2 border bg-muted/40 border-border/60 rounded-xl group/summary"
    >
      <div className="flex items-center w-full gap-2">
        <div
          {...attributes}
          {...listeners}
          className="transition-colors cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground no-print"
        >
          <GripVertical size={14} />
        </div>
        <div className="w-6 h-6 flex items-center justify-center bg-muted rounded text-[10px] font-black text-muted-foreground">
          {letterId}
        </div>
        <div className="flex items-center min-w-0 gap-2 flex-1">
          <div className="relative min-w-0 overflow-hidden bg-background border rounded-lg h-8 border-border flex-1">
            <input
              className="w-full h-full px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-transparent outline-none focus:bg-primary/5 transition-colors"
              value={item.label}
              placeholder="Label"
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
          <div className="text-muted-foreground/40 font-bold text-[10px]">:</div>
          <div className="relative min-w-0 overflow-hidden bg-background border rounded-lg h-8 border-border flex-[1.5]">
            <input
              className="w-full h-full px-2 text-[10px] font-lexend text-muted-foreground/70 bg-transparent outline-none focus:bg-primary/5 transition-colors"
              value={item.formula || ""}
              placeholder="Formula (e.g. prev * 0.1)"
              onChange={(e) => onUpdate({ formula: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end w-full gap-2">
        <div className="text-[12px] font-lexend font-black text-muted-foreground/80 min-w-[40px] text-right">
          ₦{Math.round(calculatedValue).toLocaleString()}
        </div>
        <button
          onClick={onRemove}
          className="p-1 transition-colors text-muted-foreground/30 hover:text-destructive"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const Editor = () => {
  console.log("[Editor] HMR Reloaded at", new Date().toLocaleTimeString());
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const coordContainerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromFolder = location.state?.fromFolder;
  const queryClient = useQueryClient();
  const [finalisedPdfUrl, setFinalisedPdfUrl] = useState<string | null>(null);

  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);
  // Real-time collaborative document content — shared across every client
  // connected to the `doc-{id}` Hocuspocus room.
  const editorAction = useSyncedStore(editorStore);
  
  const { user: currentUser, businessId, businessName: ctxBusinessName, projectId, businessAssets } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [lastUpdated, setLastUpdated] = useState(0);
  const bump = () => setLastUpdated(prev => prev + 1);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Inventory-picker modal — opened by the "From Inventory" button on the
  // empty-state / end-of-rows footer. The modal returns picks; we map them
  // into invoice rows using simple column-label heuristics.
  const [inventoryPickerOpen, setInventoryPickerOpen] = useState(false);

  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [myClientId, setMyClientId] = useState<string>("unknown");
  // localMeta: Fallback for invoices not in the global project documents list (e.g. projectID is null)
  const [localMeta, setLocalMeta] = useState<any>(null);
  // Business name comes directly from AuthContext (which reads /api/users/profile).
  // Firestore has been fully removed — the backend is the single source of truth.
  const businessName = ctxBusinessName || "Your Business";

  const [jsonInput, setJsonInput] = useState<string>("");
  const [headerImage, setHeaderImage] = useState<string>(
    () => businessAssets?.logoUrl || localStorage.getItem("headerImage") || "/Shan-Invoice.png",
  );
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );
  const [isPreview, setIsPreview] = useState(false);
  const [rawInput, setRawInput] = useState<string>("");
  const [history, setHistory] = useState<DocData[]>([]);
  const [future, setFuture] = useState<DocData[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedHeaderType, setSelectedHeaderType] = useState<'logo' | 'letterhead1' | 'letterhead2' | 'letterhead3'>('logo');

  const { data: allDocuments = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => api.getDocuments(projectId!),
    enabled: !!currentUser && !!projectId,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    enabled: !!currentUser,
  });

  const activeProject = useMemo(() => {
    return allProjects.find((p: any) => p.id === projectId);
  }, [allProjects, projectId]);

  const docMetadata = useMemo(() => {
    return allDocuments.find((d: any) => d.id === id) || localMeta;
  }, [allDocuments, id, localMeta]);

  // Absolute URL for the finalised PDF — pulled from in-memory state if the
  // user just finalised, or reconstructed from stored metadata when reopening
  // a locked invoice. Returns null when there is no finalised PDF yet.
  const downloadUrl = useMemo<string | null>(() => {
    const candidate = finalisedPdfUrl || (docMetadata as any)?.metadata?.pdfUrl;
    if (!candidate) return null;
    if (/^https?:/i.test(candidate)) return candidate as string;
    const origin = API_BASE.replace(/\/api\/?$/, '');
    return `${origin}/${String(candidate).replace(/^\//, '')}`;
  }, [finalisedPdfUrl, docMetadata]);

  // Once this doc loads and it's locked, default to Preview mode — the same
  // view the user gets from the toolbar's Preview toggle. Locked invoices
  // shouldn't open into the editing scaffold; the user just wants to see the
  // finished document. We do this once per doc id; the existing Preview
  // button still toggles freely after that.
  const primedDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !docMetadata) return;
    if (primedDocIdRef.current === id) return;
    primedDocIdRef.current = id;
    if (docMetadata.status === 'locked') {
      setIsPreview(true);
    }
  }, [id, docMetadata]);

  // Fetch invoice management data — this is the source of truth for totals
  // and receipts (which live in the invoices table, not the documents table).
  const { data: invoiceMgmtData } = useQuery({
    queryKey: ['invoice-management', id],
    queryFn: () => api.getInvoiceManagement(id!),
    enabled: !!id && !!currentUser,
  });

  const hasFinalizedReceipts = useMemo(() => {
    return (invoiceMgmtData?.chain?.length || 0) > 0;
  }, [invoiceMgmtData]);

  const availableEmails = useMemo(() => {
    if (!activeProject || !docMetadata) return [];
    const projectMembers = (activeProject.members || []).map(m => (typeof m === 'string' ? m : m.email));
    const docMembers = (docMetadata.members || []).map((m: any) => (typeof m === 'string' ? m : m.email));
    return projectMembers.filter(email => !docMembers.includes(email));
  }, [activeProject, docMetadata]);

  // Resolve the current user's role for this document. Precedence:
  //   1. Document/project owner → owner
  //   2. Project-level role (myRole on the active project, set by backend)
  //   3. Doc-level members[] entry
  //   4. Fall back to 'viewer' (safe default)
  const userRole = useMemo<MemberRole>(() => {
    if (!currentUser?.email) return 'viewer';
    if (docMetadata?.isOwner) return 'owner';

    const activeProject = workspaceAction.projects?.find((p: any) => p.id === projectId);
    if (activeProject?.myRole) return activeProject.myRole as MemberRole;

    const member = (docMetadata?.members || []).find((m: any) =>
      (typeof m === 'string' ? m : m.email) === currentUser.email,
    );
    if (member) {
      return (typeof member === 'object' ? member.role : 'editor') as MemberRole;
    }
    return 'viewer';
  }, [docMetadata, currentUser?.email, workspaceAction.projects, projectId]);

  const isReadOnly = useMemo(() => {
    if (isPreview) return true;
    if (docMetadata?.status === 'locked') return true;
    if (hasFinalizedReceipts) return true;
    return !canWrite(userRole);
  }, [isPreview, userRole, docMetadata?.status, hasFinalizedReceipts]);

  const lockReason = useMemo(() => {
    if (!isReadOnly) return null;
    if (isPreview) return null;
    if (docMetadata?.status === 'locked') return "This invoice is locked for editing";
    if (hasFinalizedReceipts) return "This invoice is locked because receipts have been issued for it";
    if (!canWrite(userRole)) return `View-only — your role (${userRole}) cannot edit this document`;
    return "This document is read-only";
  }, [isReadOnly, isPreview, docMetadata?.status, hasFinalizedReceipts, userRole]);

  // Editor Annotations state (stored in docMetadata.metadata)
  const annotations = useMemo(() => {
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
    queryClient.invalidateQueries({ queryKey: [ 'documents', projectId ] });
  };

  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [ authAction.bannedClients, currentUser, navigate ]);

  useEffect(() => {
    if (docMetadata) {
      console.log('[Editor] 📄 Document Metadata:', docMetadata);
    }
  }, [docMetadata]);

  // `docData` is the real-time collaborative proxy. When another peer changes
  // a field, `useSyncedStore(editorStore)` re-renders and we see it.
  const docData = (
    editorAction.content && Object.keys(editorAction.content).length > 0
      ? (editorAction.content as unknown as DocData)
      : undefined
  );

  const activeRow = useMemo(() => {
    if (!activeId || !docData) return null;
    return (docData.table.rows || []).find(r => r.id === activeId);
  }, [activeId, docData?.table?.rows]);

  useEffect(() => {
    if (docData) {
      console.log('[Editor] 📝 Live Document Data (docData):', docData);
    }
  }, [docData]);

  // FORCE GLOBAL PIVOT: If the project is switched while editing, kick out to dashboard.
  // IMPORTANT: skip the check when the doc has no project link (projectId = null),
  // which is the case for invoices created before a project was available.
  useEffect(() => {
    if (docMetadata && docMetadata.projectId && docMetadata.projectId !== projectId) {
      console.warn("[Pivot] 🚨 Project mismatch detected. Redirecting to dashboard.");
      navigate("/dashboard");
    }
  }, [docMetadata?.projectId, projectId, navigate]);

  useEffect(() => {
    if (!currentUser || !businessId || !id) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await currentUser.getIdToken();
      // 1. Connect to project room (for workspace data + team presence)
      connectProject(projectId!, token, businessId!);
      // 2. Connect to the per-document room (real-time content + doc presence)
      const editorProvider = connectEditor(id, token);

      // Per-document presence — only users viewing THIS invoice show up here.
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

      // Seed the shared content from REST the first time someone opens the
      // doc. If another peer is already in the room, Hocuspocus will have
      // pushed their state to us before this fires, so we'll skip the seed.
      const seedIfEmpty = async () => {
        try {
          if (Object.keys(editorStore.content || {}).length > 0) return;

          // 1. Try the regular documents list
          const all = await api.getDocuments(projectId!);
          const found = all.find((d: any) => d.id === id);
          if (found?.content && Object.keys(editorStore.content || {}).length === 0) {
            Object.assign(editorStore.content, found.content);
            console.log('[Editor] 📥 Seeded content from REST (documents list)');
          }
          if (found) setLocalMeta(found);

          // 2. Fallback: fetch the document directly (handles invoices table)
          try {
            const single = await api.getDocument(id!);
            if (single) {
              setLocalMeta(single);
              if (single.content && Object.keys(editorStore.content || {}).length === 0) {
                Object.assign(editorStore.content, single.content);
                console.log('[Editor] 📥 Seeded content from REST (direct document fetch)');
              }
            }
          } catch (e) {
            console.warn('[Editor] direct document fetch failed for seed:', e);
          }
        } catch (e) {
          console.error('[Editor] seed from REST failed', e);
        }
      };

      editorProvider.on('synced', seedIfEmpty);
      // Safety net in case the `synced` event has already fired before we
      // registered the handler (fast reconnects).
      setTimeout(seedIfEmpty, 600);

      setIsSyncReady(true);
      cleanup = () => {
        editorProvider.awareness?.off('change', updatePresence);
        editorProvider.off('synced', seedIfEmpty);
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId, id, projectId]);

  // --- Collaborative auto-save ---------------------------------------------
  // Listen to Yjs updates on the editor doc and debounce a REST save so the
  // backend always has the latest snapshot (durable across refresh / cold
  // starts). Only a short debounce — Hocuspocus is the real-time transport,
  // REST is just the persistence layer.
  useEffect(() => {
    if (!id || !isSyncReady) return;
    const yDoc = getYjsDoc(editorStore);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSave = () => {
      if (isReadOnly) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (!editorStore.content || Object.keys(editorStore.content).length === 0) return;
          
          // Calculate authoritative totals to "burn into" the snapshot
          const { subTotal, grandTotal } = computeTotalPrice(editorStore.content as unknown as DocData);
          
          const snapshot = JSON.parse(JSON.stringify(editorStore.content));
          // Attach totals so backend doesn't have to recompute them (uses provided values)
          snapshot.subTotal = subTotal;
          snapshot.grandTotal = grandTotal;

          api.updateDocument(id, snapshot).catch(err =>
            console.warn('[Editor] auto-save failed:', err)
          );
        } catch (e) {
          console.error('[Editor] failed to snapshot content for auto-save', e);
        }
      }, 2000);
    };

    yDoc.on('update', scheduleSave);
    return () => {
      yDoc.off('update', scheduleSave);
      if (timer) clearTimeout(timer);
    };
    // Include isReadOnly so the listener re-binds when the invoice becomes
    // locked — otherwise the captured closure keeps firing 403s against the
    // now-locked document.
  }, [id, isSyncReady, isReadOnly]);


  const useSections = docData?.useSections ?? false;
  const showBOQSummary = docData?.showBOQSummary ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // isLoadingDoc: wait until docMetadata is resolved OR we've confirmed it's
  // in the invoices table (it may not appear in allDocuments if projectId is null
  // and the query is disabled). We allow it to proceed once isSyncReady.
  const isLoadingDoc = !docMetadata && !isSyncReady;

  const updateDocData = (
    newData: DocData | ((prev: DocData | null) => DocData | null),
  ) => {
    // The source of truth for document content is the collaborative proxy
    // `editorStore.content`. Mutating it here broadcasts via Yjs to every
    // connected peer in the same `doc-{id}` room.
    if (!editorStore.content) return;
    const next = typeof newData === "function" ? newData(docData as any) : newData;
    if (!next) return;
    // Wipe removed keys, then assign the fresh ones. We can't just
    // `editorStore.content = next` because SyncedStore doesn't allow root
    // reassignment — only in-place property mutation.
    const currentKeys = Object.keys(editorStore.content);
    const nextKeys = new Set(Object.keys(next));
    for (const k of currentKeys) {
      if (!nextKeys.has(k)) delete (editorStore.content as any)[k];
    }
    if (isReadOnly) return;
    Object.assign(editorStore.content, next);
    bump();
  };

  const undo = () => {
    if (history.length === 0 || !docData) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [docData, ...f]);
    updateDocData(prev);
  };

  const redo = () => {
    if (future.length === 0 || !docData) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, docData]);
    updateDocData(next);
  };

  // --- Real-time content management ---
  useEffect(() => {
    if (!id || !docData) return;
    setJsonInput(JSON.stringify(docData, null, 2));
  }, [docData, id]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: docData?.footer.notes || "",
    onUpdate: ({ editor }) => {
      if (docData) docData.footer.notes = editor.getHTML();
    },
    immediatelyRender: false,
  });
//  Riverside

  useEffect(() => {
    if (
      editor &&
      docData?.footer.notes &&
      docData.footer.notes !== editor.getHTML()
    ) {
      editor.commands.setContent(docData.footer.notes);
    }
  }, [docData?.footer.notes, editor]);

  useEffect(() => {
    localStorage.setItem("headerImage", headerImage || "");
  }, [headerImage]);

  useEffect(() => {
    localStorage.setItem("headerHeight", headerHeight.toString());
  }, [headerHeight]);

  useEffect(() => {
    if (docData && docData.table.rows.some((r) => !r.id)) {
      const updatedRows = (docData.table.rows || []).map((r) =>
        r.id ? r : { ...r, id: crypto.randomUUID() },
      );
      updateDocData({
        ...docData,
        table: { ...docData.table, rows: updatedRows },
      });
    }
  }, [docData]);

  // Migration: Automatically add Markup column to BOQ tables if missing
  useEffect(() => {
    if (!docData) return;
    const cols = docData.table.columns || [];
    const hasMarkup = cols.some(c => c.id === 'markup');
    
    // Check if it looks like a standard BOQ (has Qty in D and Rate in E)
    const hasQty = cols.some(c => c.id === 'D' && c.label.toLowerCase().includes('qty'));
    const hasRate = cols.some(c => c.id === 'E' && c.label.toLowerCase().includes('rate'));
    const totalCol = cols.find(c => c.id === 'F' && c.type === 'formula');

    if (!hasMarkup && hasQty && hasRate && totalCol) {
      // 1. Inject column
      const fIdx = cols.findIndex(c => c.id === 'F');
      if (fIdx !== -1) {
        docData.table.columns.splice(fIdx, 0, { 
          id: 'markup', 
          label: 'Markup (%)', 
          type: 'number', 
          width: '100px' 
        });
      }
      
      // 2. Update Total formula
      totalCol.formula = "(D * E) * (1 + markup/100)";

      // 3. Initialize row values
      docData.table.rows.forEach(row => {
        if (row.rowType === 'row' || !row.rowType) {
          if (row.markup === undefined) row.markup = 0;
        }
      });
    }
  }, [docData]);

  const onUpdateInvoiceCode = (updates: Partial<InvoiceCode>) => {
    if (!docData) return;
    if (!docData.invoiceCode) {
      docData.invoiceCode = {
        text: "",
        prefix: "INV",
        company: "IS",
        count: "0001",
        year: String(new Date().getFullYear()),
        x: 600,
        y: 100,
        color: "#503D36",
        ...updates
      } as any;
    } else {
      Object.assign(docData.invoiceCode, updates);
    }
    
    // Sync the combined text field — format: PREFIX/COMPANY/COUNT/YEAR
    const ic = docData.invoiceCode;
    if (ic) {
      ic.text = `${ic.prefix || "INV"}/${ic.company || "IS"}/${ic.count || "0001"}/${ic.year || new Date().getFullYear()}`;
    }
  };

  const handleRawImport = () => {
    if (!rawInput.trim() || !docData) return;

    const sections = rawInput.split(/\n\s*\n/);
    let newContact = { ...docData.contact };
    let newTitle = docData.title;
    let newRows: TableRow[] = [];

    sections.forEach((section) => {
      const lines = section.trim().split("\n");
      const firstLineLower = lines[0].toLowerCase();

      if (firstLineLower.includes("contact")) {
        const sameLineContent = lines[0].split(":").slice(1).join(":").trim();
        const dataLines = sameLineContent
          ? [sameLineContent, ...lines.slice(1)]
          : lines.slice(1);
        if (dataLines[0]) newContact.name = dataLines[0].trim();
        if (dataLines[1]) newContact.address1 = dataLines[1].trim();
        if (dataLines[2]) newContact.address2 = dataLines[2].trim();
      } else if (
        firstLineLower.includes("title") ||
        firstLineLower.includes("ttitle")
      ) {
        const sameLineTitle = lines[0].split(":").slice(1).join(":").trim();
        const titleLines = sameLineTitle
          ? [sameLineTitle, ...lines.slice(1)]
          : lines.slice(1);
        newTitle = titleLines.join("\n").trim();
      } else if (firstLineLower.includes("content")) {
        lines.slice(1).forEach((line) => {
          const rowMatch = line.trim().match(/^-?\s*(.*?)\s+([\d,]+)$/);
          if (rowMatch) {
            newRows.push({
              id: crypto.randomUUID(),
              rowType: "row",
              B: rowMatch[1].trim(),
              C: 1,
              D: Number(rowMatch[2].replace(/,/g, "")),
            });
          }
        });
      }
    });

    if (docData) {
      if (newRows.length > 0) {
        docData.table.rows.splice(0, docData.table.rows.length, ...newRows);
      }
      docData.title = newTitle;
      Object.assign(docData.contact, newContact);
      setJsonInput(JSON.stringify(docData, null, 2));
    }
  };

  const handleApplyJson = () => {
    try {
      if (!jsonInput.trim() || !docData) return;
      const parsed = JSON.parse(jsonInput);
      // Carefully merge into the proxy without destroying it
      Object.assign(docData, parsed);
    } catch (e) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

  const onMoveRow = useCallback((targetId: string, dir: "up" | "down") => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const target = dir === "up" ? i - 1 : i + 1;
      if (target < 0 || target >= docData.table.rows.length) return;
      const [movedItem] = docData.table.rows.splice(i, 1);
      docData.table.rows.splice(target, 0, movedItem);
    }
  }, [docData]);

  const onAddSectionBelow = useCallback((targetId: string, numbered?: boolean) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      docData.table.rows.splice(i + 1, 0, {
        id: crypto.randomUUID(),
        rowType: "section-header",
        sectionTitle: "New Section",
        affectsNumbering: numbered ?? true,
      });
    }
  }, [docData]);

  const onAddSectionAbove = useCallback((targetId: string, numbered?: boolean) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      docData.table.rows.splice(i, 0, {
        id: crypto.randomUUID(),
        rowType: "section-header",
        sectionTitle: "New Section",
        affectsNumbering: numbered ?? true,
      });
    }
  }, [docData]);

  const onRemoveRow = useCallback((targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i !== -1) {
        docData.table.rows.splice(i, 1);
        bump();
      }
    }
  }, [docData]);

  const onAddSubSectionBelow = useCallback((targetId: string, numbered?: boolean, type?: TableRow["rowType"]) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const actualType = type ?? "sub-section-header";
      docData.table.rows.splice(i + 1, 0, {
        id: crypto.randomUUID(),
        rowType: actualType,
        sectionTitle: actualType === "section-total" ? "Section Total" : "New Sub-section",
        affectsNumbering: numbered ?? true,
      });
    }
  }, [docData]);

  const onAddSubSectionAbove = useCallback((targetId: string, numbered?: boolean, type?: TableRow["rowType"]) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const actualType = type ?? "sub-section-header";
      docData.table.rows.splice(i, 0, {
        id: crypto.randomUUID(),
        rowType: actualType,
        sectionTitle: actualType === "section-total" ? "Section Total" : "New Sub-section",
        affectsNumbering: numbered ?? true,
      });
    }
  }, [docData]);

  const onAddRowBelow = useCallback((targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const newRow: TableRow = { id: crypto.randomUUID(), rowType: "row" };
      docData.table.columns.forEach((col) => {
        if (col.type === "index") return;
        newRow[col.id] = col.type === "number" ? 0 : "";
      });
      docData.table.rows.splice(i + 1, 0, newRow as any);
      bump();
    }
  }, [docData]);

  /**
   * Insert a batch of inventory picks as new rows at the end of the table.
   *
   * Column-mapping heuristics (each invoice template has its own column
   * structure — BOQ vs Procurement vs Labour all differ):
   *   - Item name → first text column matching /description|item|scope|
   *     stage|product|vendor/i, else the first text column
   *   - Unit      → text column matching /unit|type|measure/i (other than
   *     the name column above)
   *   - Quantity  → number column matching /qty|quantity|duration/i
   *   - Rate/cost → number column matching /rate|price|cost|amount|fee/i
   *
   * Anything that doesn't match keeps its default initialization. Each
   * row also stamps `_inventoryItemId` so the catalog soft-link survives
   * round-trips through save/load.
   */
  const onInsertInventoryPicks = useCallback((picks: InventoryPick[]) => {
    if (!docData || picks.length === 0) return;

    const cols: any[] = docData.table.columns || [];
    const textCols = cols.filter((c) => c.type === "text");
    const numberCols = cols.filter((c) => c.type === "number");

    const nameCol =
      textCols.find((c) =>
        /description|item|scope|stage|product|vendor/i.test(c.label || ""),
      ) || textCols[0];
    const unitCol = textCols.find(
      (c) => c !== nameCol && /unit|type|measure/i.test(c.label || ""),
    );
    const qtyCol = numberCols.find((c) =>
      /qty|quantity|duration/i.test(c.label || ""),
    );
    const rateCol = numberCols.find((c) =>
      /rate|price|cost|amount|fee/i.test(c.label || ""),
    );

    const newRows: any[] = picks.map(({ item, quantity }) => {
      const row: any = {
        id: crypto.randomUUID(),
        rowType: "row",
        _inventoryItemId: item.id,
      };
      // Initialize every column with its default — same as onAddRowBelow.
      cols.forEach((col) => {
        if (col.type === "index") return;
        row[col.id] = col.type === "number" ? 0 : "";
      });
      if (nameCol) row[nameCol.id] = item.name;
      if (unitCol && item.unit) row[unitCol.id] = item.unit;
      if (qtyCol) row[qtyCol.id] = quantity;
      if (rateCol && item.defaultCost != null) row[rateCol.id] = item.defaultCost;
      return row;
    });

    // Bulk insert at the end of the rows array — same pattern as the
    // template-load splice. SyncedStore broadcasts the change.
    docData.table.rows.splice(docData.table.rows.length, 0, ...newRows);
    bump();
  }, [docData]);

  const onAddRowAbove = useCallback((targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const newRow: TableRow = { id: crypto.randomUUID(), rowType: "row" };
      docData.table.columns.forEach((col) => {
        if (col.type === "index") return;
        newRow[col.id] = col.type === "number" ? 0 : "";
      });
      docData.table.rows.splice(i, 0, newRow as any);
      bump();
    }
  }, [docData]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id && docData) {
      const oldIndex = docData.table.rows.findIndex((r) => r.id === active.id);
      const newIndex = docData.table.rows.findIndex((r) => r.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Multi-page reordering in SyncedStore requires cloning the item to avoid "already in tree" errors
        const item = JSON.parse(JSON.stringify(docData.table.rows[oldIndex]));
        docData.table.rows.splice(oldIndex, 1);
        docData.table.rows.splice(newIndex, 0, item);
        bump();
      }
    }
  }, [docData]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleSummaryDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && docData) {
      const oldIndex = docData.table.summary.findIndex(
        (s) => s.id === active.id,
      );
      const newIndex = docData.table.summary.findIndex(
        (s) => s.id === over?.id,
      );
      if (oldIndex !== -1 && newIndex !== -1) {
        const item = JSON.parse(JSON.stringify(docData.table.summary[oldIndex]));
        docData.table.summary.splice(oldIndex, 1);
        docData.table.summary.splice(newIndex, 0, item);
        bump();
      }
    }
  }, [docData]);

  const handleHeaderResize = useCallback((e: React.MouseEvent) => {
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
  }, [headerHeight]);

  const getHeaderImageUrl = useCallback((type: 'logo' | 'letterhead1' | 'letterhead2' | 'letterhead3'): string => {
    switch (type) {
      case 'logo':
        return businessAssets?.logoUrl || "/Shan-Invoice.png";
      case 'letterhead1':
        return businessAssets?.letterheadUrl1 || "/Shan-Invoice.png";
      case 'letterhead2':
        return businessAssets?.letterheadUrl2 || "/Shan-Invoice.png";
      case 'letterhead3':
        return businessAssets?.letterheadUrl3 || "/Shan-Invoice.png";
      default:
        return "/Shan-Invoice.png";
    }
  }, [businessAssets]);

  const handleHeaderTypeChange = useCallback((type: 'logo' | 'letterhead1' | 'letterhead2' | 'letterhead3') => {
    setSelectedHeaderType(type);
    setHeaderImage(getHeaderImageUrl(type));
  }, [getHeaderImageUrl]);


  const getLetterId = (idx: number) => String.fromCharCode(65 + idx);

  const { subTotal, summaries, grandTotal } = 
    docData ? computeTotalPrice(docData) : { subTotal: 0, summaries: [], grandTotal: 0 };

  const totalPriceObj: TotalPrice = {
    subTotal,
    summaries,
    grandTotal,
  };

  const resolveSectionTotalBackwardWrapper = useCallback(
    (rows: TableRow[], fromIdx: number) =>
      docData ? resolveSectionTotalBackward(rows, fromIdx, docData) : 0,
    [docData],
  );

  const resolveSectionTotalWrapper = useCallback(
    (rows: TableRow[], fromIdx: number) =>
      docData ? resolveSectionTotal(rows, fromIdx, docData) : 0,
    [docData],
  );

  const summaryForRender = summaries;

  const rowNumbering = useMemo(
    () => getRowNumbering(docData?.table.rows || [], useSections),
    [docData?.table.rows, useSections, lastUpdated],
  );

  const pages = useMemo(
    () => (docData ? calculateChunks(docData, headerHeight, useSections) : []),
    [docData, headerHeight, useSections, docData?.table.rows, lastUpdated],
  );

  // Project members have full access; per-document membership is a fallback
  const email = currentUser?.email || "";
  const isProjectMember = workspaceAction.projects?.some(
    (p: any) => p.id === (docMetadata?.projectId || projectId) && 
      (p.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email)
  );
  const isMember = isProjectMember || (docMetadata && 
    (docMetadata.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email)
  );

  // ── Stable field-update callbacks ─────────────────────────────────────────
  // All are defined BEFORE the early-return so they obey Rules of Hooks.
  // Each guards against !docData so they're safe to call before content loads.

  const onUpdateContact = useCallback((field: keyof Contact, value: string) => {
    if (docData) docData.contact[field] = value;
  }, [docData]);

  const onUpdateTitle = useCallback((value: string) => {
    if (docData) docData.title = value;
  }, [docData]);

  const onUpdateCell = useCallback((
    rowId: string,
    colId: string,
    value: string | number | boolean,
  ) => {
    if (!docData) return;
    const row = docData.table.rows.find((r: any) => r.id === rowId);
    if (!row) return;
    const column = docData.table.columns.find((c: any) => c.id === colId);
    const isNumeric = column?.type === "number";
    if (isNumeric) {
      const parsed = parseFloat(value as string);
      row[colId] = isNaN(parsed) ? 0 : parsed;
    } else {
      row[colId] = value;
    }
    bump();
  }, [docData]);

  const onUpdateSummaryItem = useCallback((id: string, label: string) => {
    if (docData) {
      const item = docData.table.summary.find((s) => s.id === id);
      if (item) item.label = label;
    }
  }, [docData]);

  const onUpdateDate = useCallback((v: string) => {
    if (docData) docData.date = v;
  }, [docData]);

  const onUpdatePaymentMethod = useCallback((v: string) => {
    if (docData) docData.paymentMethod = v;
  }, [docData]);

  const onUpdateTransactionId = useCallback((v: string) => {
    if (docData) docData.transactionId = v;
  }, [docData]);

  const onUpdateReference = useCallback((v: string) => {
    if (docData) docData.reference = v;
  }, [docData]);

  const onUpdateSignature = useCallback((v: string) => {
    if (docData) docData.signature = v;
  }, [docData]);

  const onUpdateReceiptMessage = useCallback((v: string) => {
    if (docData) docData.receiptMessage = v;
  }, [docData]);

  // ── Early return after all hooks ──────────────────────────────────────────
  if (isLoadingDoc || !docData)
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        <RefreshCw className="animate-spin text-muted-foreground/30" size={32} />
      </div>
    );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      <header className="h-14 border-b border-border bg-card flex items-center gap-2 px-6 shrink-0 shadow-sm z-30 transition-colors duration-300 no-print">
        <button
          onClick={() => {
            // Locked invoices open in preview from the management page —
            // sending the user back there is more useful than the dashboard.
            if (docMetadata?.status === 'locked' && id) {
              navigate(`/invoice/${id}`, { state: { fromFolder } });
              return;
            }
            navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : "/dashboard");
          }}
          className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-px h-6 bg-border/40 mx-2" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-foreground">Editor</h2>
            {docMetadata?.status === 'locked' && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">
                <Shield size={10} strokeWidth={3} />
                <span className="text-[8px] font-black uppercase tracking-widest">Locked</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">
            {docMetadata?.name || "Untitled"}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {/* Status Indicator — only relevant while editing is possible */}
          {docMetadata?.status !== 'locked' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
              <SignalIcon size={10} className="text-success animate-pulse" />
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

          {docMetadata?.status !== 'locked' && (
            <>
              <div className="h-6 w-px bg-border/40 mx-1" />

              <button
                onClick={() => setIsPreview(!isPreview)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-sm",
                  isPreview
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                )}
              >
                 {isPreview ? <ArrowLeft size={12} /> : <FileText size={12} />}
                 {isPreview ? "Exit Preview" : "Preview"}
              </button>
            </>
          )}

          <div className="h-6 w-px bg-border/40 mx-1" />



          <button
            onClick={() => window.print()}
            className="p-1.5 bg-muted text-muted-foreground border border-border rounded-lg transition-all shadow-sm hover:bg-muted/80 active:scale-95 no-print"
            title="Print (Browser)"
          >
            <Printer size={16} />
          </button>

          {downloadUrl && docMetadata?.status !== 'locked' && (
            <a
              href={downloadUrl}
              download={`${(docMetadata as any)?.name || 'invoice'}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-muted text-muted-foreground border border-border rounded-lg transition-all shadow-sm hover:bg-muted/80 hover:text-foreground active:scale-95 no-print inline-flex items-center justify-center"
              title="Download finalised PDF"
            >
              <Download size={16} />
            </a>
          )}

          {docMetadata?.status !== 'locked' && !finalisedPdfUrl && !hasFinalizedReceipts && (
            <button
              onClick={async () => {
                const confirm = window.confirm("Finalising this invoice will lock it for further edits and generate a PDF. Proceed?");
                if (!confirm) return;
                try {
                  const res = await api.finaliseInvoice(id!);
                  const url = res.url || res.pdfUrl;
                  if (url) {
                    setFinalisedPdfUrl(url);
                    queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
                  } else {
                    navigate(`/invoice/${id}`);
                  }
                } catch (e) {
                  alert("Finalization failed");
                }
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-success text-success-foreground rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 active:scale-95"
            >
              <Check size={14} /> Finalize Invoice
            </button>
          )}



          {docMetadata?.status !== 'locked' && (
            <button
              onClick={() => {
                navigate(`/invoice/${id}`);
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 active:scale-95"
            >
              <Check size={14} /> Finish Editing
            </button>
          )}
        </div>
      </header>

      {lockReason && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-warning">
          <Eye size={12} /> {lockReason}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden app-main">
        {!isPreview && (
          <div className="w-[380px] border-r border-border bg-card overflow-y-auto scrollbar-thin z-10 flex flex-col no-print">
            {/* Header / Brand (Mini) */}
            <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg text-muted-foreground shadow-sm">
                        <Edit size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Draft Editor</h2>
                        <p className="text-[8px] text-muted-foreground/30 font-bold tracking-[0.2em] uppercase">Document Config</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={undo}
                        disabled={history.length === 0}
                        className="p-2 bg-muted/40 text-muted-foreground rounded-lg hover:text-foreground disabled:opacity-30 transition-all font-black text-[10px]"
                    >
                        <Undo2 size={14} />
                    </button>
                    <button 
                        onClick={redo}
                        disabled={future.length === 0}
                        className="p-2 bg-muted/40 text-muted-foreground rounded-lg hover:text-foreground disabled:opacity-30 transition-all font-black text-[10px]"
                    >
                        <Redo2 size={14} />
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-10">
              {/* Existing sidebar content... */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">
                    Quick Import
                  </label>
                  <button
                    onClick={handleRawImport}
                    className="text-[9px] font-black px-3 py-1.5 rounded-full bg-muted text-muted-foreground uppercase tracking-widest hover:bg-muted/80 transition-all border border-border"
                  >
                    Sync Data
                  </button>
                </div>
                <textarea
                  className="w-full h-32 bg-background border border-border/60 rounded-2xl p-5 text-[10px] font-lexend focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none scrollbar-thin text-muted-foreground transition-all shadow-sm placeholder:text-muted-foreground/30"
                  placeholder="Paste contact, title, and content bullets here..."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </section>

              {showAdvanced && (
                <section className="pt-6 space-y-4 border-t border-border/40">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">
                      Developer Area
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={handleApplyJson}
                          className="text-[9px] font-black px-3 py-1.5 rounded-lg bg-muted text-muted-foreground uppercase tracking-widest hover:bg-muted/80 transition-all border border-border"
                        >
                          Apply JSON
                        </button>
                        <button
                          onClick={() => setIsCollaboratorsOpen(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-all text-[9px] font-black uppercase tracking-widest shadow-sm relative group"
                        >
                          <Users size={12} />
                          {connectedClients.length > 1 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border-2 border-card" />
                          )}
                          Collabs
                        </button>
                    </div>
                  </div>
                  <textarea
                    className="w-full h-64 bg-background border border-border/80 rounded-2xl p-5 text-[10px] font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none scrollbar-thin text-muted-foreground transition-all shadow-sm"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                </section>
              )}

              <section className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
                  Footer Notes
                </label>
                <div className="border border-muted-foreground/20 bg-muted/10 rounded-2xl p-5 min-h-[140px] focus-within:ring-2 focus-within:ring-muted-foreground/10 focus-within:border-muted-foreground/40 transition-all">
                  <EditorContent
                    editor={editor}
                    className="text-muted-foreground font-lexend text-xs prose-p:text-muted-foreground"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
                  Financial Adjustments
                </label>
                <div className="p-4 bg-muted/20 border border-border/60 rounded-3xl space-y-4">
                  <div className="flex flex-col gap-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleSummaryDragEnd}
                    >
                      <SortableContext
                        items={docData.table.summary.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {docData.table.summary.map((item, idx) => (
                          <SortableSummaryItem
                            key={item.id}
                            item={item}
                            idx={idx}
                            calculatedValue={
                              summaryForRender[idx]?.calculatedValue || 0
                            }
                            onUpdate={(updates) => {
                              if (docData?.table.summary[idx]) {
                                Object.assign(docData.table.summary[idx], updates);
                              }
                            }}
                            onRemove={() => {
                              if (docData) {
                                docData.table.summary.splice(idx, 1);
                              }
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button
                        onClick={() => {
                          if (docData) {
                            docData.table.summary.push({
                              id: crypto.randomUUID(),
                              label: "New Adjustment",
                              type: "formula" as const,
                              formula: "prev * 0",
                            });
                          }
                        }}
                      className="w-full py-3 border-2 border-dashed border-border/60 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/10 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <Plus size={14} /> Add Calculation
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
                  Emphasis Details
                </label>
                <div className="p-4 bg-muted/20 border border-border/60 rounded-3xl space-y-4">
                  <div className="flex flex-col gap-3">
                    {(docData.footer.emphasis || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl"
                      >
                        <input
                          type="text"
                          className="bg-transparent border-none outline-none font-black text-[9px] uppercase tracking-widest text-muted-foreground/60 w-24"
                          value={item.key}
                          placeholder="KEY"
                          onChange={(e) => {
                            const newEmphasis = [
                              ...(docData.footer.emphasis || []),
                            ];
                            newEmphasis[idx] = { ...item, key: e.target.value };
                            updateDocData({
                              ...docData,
                              footer: {
                                ...docData.footer,
                                emphasis: newEmphasis,
                              },
                            });
                          }}
                        />
                        <div className="w-px h-4 bg-border/60" />
                        <input
                          type="text"
                          className="bg-transparent border-none outline-none text-[11px] font-bold text-muted-foreground w-full placeholder:text-muted-foreground/30"
                          value={item.value}
                          placeholder="Value"
                          onChange={(e) => {
                            if (docData?.footer.emphasis) {
                              docData.footer.emphasis[idx].value = e.target.value;
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (docData?.footer.emphasis) {
                              docData.footer.emphasis.splice(idx, 1);
                            }
                          }}
                          className="p-1 transition-colors text-muted-foreground/30 hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        if (docData) {
                          if (!docData.footer.emphasis) docData.footer.emphasis = [];
                          docData.footer.emphasis.push({ key: "Label", value: "Value" });
                        }
                      }}
                      className="w-full py-3 border-2 border-dashed border-border/60 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Emphasis
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
                  Document Identity
                </label>
                <div className="p-4 bg-muted/20 border border-border/60 rounded-3xl space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        Invoice Code Structure
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="w-12 h-9 p-2 text-[10px] font-black text-center bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-muted-foreground"
                          value={docData.invoiceCode?.prefix || "INV"}
                          placeholder="INV"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ prefix: e.target.value })
                          }
                        />
                        <span className="text-muted-foreground opacity-30 font-bold">/</span>
                        <input
                          type="text"
                          className="w-12 h-9 p-2 text-[10px] font-black text-center bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-muted-foreground"
                          value={docData.invoiceCode?.company || "IS"}
                          placeholder="IS"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ company: e.target.value })
                          }
                        />
                        <span className="text-muted-foreground opacity-30 font-bold">/</span>
                        <input
                          type="text"
                          className="w-16 h-9 p-2 text-[10px] font-black text-center bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-muted-foreground/10 focus:border-muted-foreground/40 text-muted-foreground font-lexend"
                          value={docData.invoiceCode?.count || "0001"}
                          placeholder="0001"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ count: e.target.value })
                          }
                        />
                        <span className="text-muted-foreground opacity-30 font-bold">/</span>
                        <input
                          type="text"
                          className="w-16 h-9 p-2 text-[10px] font-black text-center bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground font-lexend"
                          value={
                            docData.invoiceCode?.year ||
                            String(new Date().getFullYear())
                          }
                          placeholder="2026"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ year: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/40">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        Use Sections
                      </span>
                      <button
                        onClick={() => { if (docData) docData.useSections = !docData.useSections; }}
                        className={cn(
                          "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all",
                          useSections
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {useSections ? "ON" : "OFF"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        BOQ Summary
                      </span>
                      <button
                        onClick={() => { if (docData) docData.showBOQSummary = !docData.showBOQSummary; }}
                        className={cn(
                          "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all",
                          showBOQSummary
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {showBOQSummary ? "Visible" : "Hidden"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 pt-4 border-t border-border/40">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        Header Image
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleHeaderTypeChange('logo')}
                          className={cn(
                            "px-2 py-2 text-[8px] font-black uppercase rounded-lg border transition-all whitespace-nowrap text-center",
                            selectedHeaderType === 'logo'
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
                          )}
                        >
                          Logo
                        </button>
                        <button
                          onClick={() => handleHeaderTypeChange('letterhead1')}
                          className={cn(
                            "px-2 py-2 text-[8px] font-black uppercase rounded-lg border transition-all whitespace-nowrap text-center",
                            selectedHeaderType === 'letterhead1'
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
                          )}
                        >
                          Letterhead 1
                        </button>
                        <button
                          onClick={() => handleHeaderTypeChange('letterhead2')}
                          className={cn(
                            "px-2 py-2 text-[8px] font-black uppercase rounded-lg border transition-all whitespace-nowrap text-center",
                            selectedHeaderType === 'letterhead2'
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
                          )}
                        >
                          Letterhead 2
                        </button>
                        <button
                          onClick={() => handleHeaderTypeChange('letterhead3')}
                          className={cn(
                            "px-2 py-2 text-[8px] font-black uppercase rounded-lg border transition-all whitespace-nowrap text-center",
                            selectedHeaderType === 'letterhead3'
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
                          )}
                        >
                          Letterhead 3
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
                  Table Schema
                </label>
                <div className="p-4 bg-muted/20 border border-border/60 rounded-3xl space-y-2">
                  {docData.table.columns.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between px-1"
                    >
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                        {col.label}
                      </span>
                      <button
                        onClick={() => {
                          if (docData) {
                            const c = docData.table.columns.find(x => x.id === col.id);
                            if (c) c.hidden = !c.hidden;
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all",
                          col.hidden
                            ? "bg-muted text-muted-foreground border-border"
                            : "bg-foreground text-background border-foreground shadow-sm",
                        )}
                      >
                        {col.hidden ? "HIDDEN" : "VISIBLE"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors border-t border-border/40 flex items-center justify-center gap-2"
              >
                {showAdvanced
                  ? "Hide Advanced Settings"
                  : "Show Advanced Settings"}
              </button>

            </div>
          </div>
        )}

        <div 
          ref={containerRef}
          className={cn("flex-1 relative overflow-y-auto custom-scrollbar flex flex-col items-center transition-all duration-500", finalisedPdfUrl ? "bg-[#323639] p-0" : "bg-slate-50/50 p-8")}
        >
          {finalisedPdfUrl ? (
            <div className="w-full h-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
               <div className="w-full max-w-5xl h-full bg-card shadow-2xl overflow-hidden border border-white/5 relative">
                 <PdfViewer 
                   url={finalisedPdfUrl}
                   annotations={annotations}
                   onSaveAnnotations={handleSaveAnnotations}
                   role={userRole}
                   className="w-full h-full"
                 />
               </div>
               <div className="my-8 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300 no-print">
                  <div className="px-5 py-2.5 bg-success/20 border border-success/30 rounded-2xl flex items-center gap-3 text-success shadow-lg shadow-success/10">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Finalized High-Fidelity Master Document</span>
                  </div>
                  <button 
                    onClick={() => setFinalisedPdfUrl(null)}
                    className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all underline underline-offset-8 decoration-white/20 hover:decoration-white"
                  >
                    <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    Switch to draft view
                  </button>
               </div>
            </div>
          ) : (
            <div ref={contentRef} className="relative w-full flex flex-col items-center min-h-full">

            {/* Coordinate-stable container for document and annotations */}
            <div ref={coordContainerRef} className="relative w-fit flex flex-col items-center">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext 
                  items={(docData?.table.rows || []).map(r => r.id as string)}
                  strategy={verticalListSortingStrategy}
                >
                  {pages.map((page, pageIndex) => (
                    <A4Page
                      key={`page-${page.startIndex}-${pageIndex}`}
                      data={docData}
                      rows={page.rows}
                      pageIndex={pageIndex}
                      totalPrice={{ subTotal, summaries: summaryForRender, grandTotal }}
                      headerImage={headerImage}
                      headerHeight={headerHeight}
                      onHeaderResize={handleHeaderResize}
                      isFirstPage={pageIndex === 0}
                      isLastPage={pageIndex === pages.length - 1}
                      startIndex={page.startIndex}
                      isEndOfRows={page.isEndOfRows}
                      showRows={page.showRows}
                      showTotals={page.showTotals}
                      showFooter={page.showFooter}
                      rowNumbering={rowNumbering}
                      onUpdateContact={onUpdateContact}
                      onUpdateTitle={onUpdateTitle}
                      onUpdateCell={onUpdateCell}
                      onRemoveRow={onRemoveRow}
                      onAddRowBelow={onAddRowBelow}
                      onAddRowAbove={onAddRowAbove}
                      onOpenInventoryPicker={() => setInventoryPickerOpen(true)}
                      onAddSectionBelow={onAddSectionBelow}
                      onAddSectionAbove={onAddSectionAbove}
                      onAddSubSectionBelow={onAddSubSectionBelow}
                      onAddSubSectionAbove={onAddSubSectionAbove}
                      onMoveRow={onMoveRow}
                      onUpdatePaymentMethod={onUpdatePaymentMethod}
                      onUpdateSignature={onUpdateSignature}
                      useSections={useSections}
                      resolveFormula={resolveFormula}
                      resolveSectionTotalBackward={resolveSectionTotalBackwardWrapper}
                      resolveSectionTotal={resolveSectionTotalWrapper}
                      onUpdateInvoiceCode={(updates) => {
                        if (docData) {
                          if (!docData.invoiceCode) {
                            docData.invoiceCode = {
                              text: "",
                              x: 0,
                              y: 0,
                              color: "",
                              ...updates
                            } as any;
                            Object.assign(docData.invoiceCode!, updates);
                          } else {
                            Object.assign(docData.invoiceCode!, updates);
                          }
                        }
                      }}
                      onUpdateSummaryItem={onUpdateSummaryItem}
                      onUpdateDate={onUpdateDate}
                      onUpdateReceiptMessage={onUpdateReceiptMessage}
                      onUpdateTransactionId={onUpdateTransactionId}
                      onUpdateReference={onUpdateReference}
                      isPreview={isReadOnly || isPreview}
                      isReadOnly={isReadOnly}
                      rowsLength={(docData.table.rows || []).length}
                      lastUpdated={lastUpdated}
                      activeId={activeId}
                    />
                  ))}
                </SortableContext>

                <DragOverlay dropAnimation={null}>
                  {activeId && activeRow && (
                    <div className="shadow-2xl opacity-90 cursor-grabbing bg-white border-2 border-primary/20 pointer-events-none">
                       <table className="w-full border-collapse">
                        <tbody>
                          <SortableRow
                            id={activeId}
                            row={activeRow}
                            idx={0}
                            startIndex={0}
                            data={docData!}
                            isPreview={true}
                            onUpdateCell={() => {}}
                            onRemoveRow={() => {}}
                            onAddRowBelow={() => {}}
                            onAddRowAbove={() => {}}
                            onAddSectionBelow={() => {}}
                            onAddSectionAbove={() => {}}
                            onAddSubSectionBelow={() => {}}
                            onAddSubSectionAbove={() => {}}
                            useSections={useSections}
                            rowNumbering={rowNumbering}
                            isReadOnly={true}
                            resolveFormula={resolveFormula}
                            resolveSectionTotalBackward={() => 0}
                            resolveSectionTotal={() => 0}
                          />
                        </tbody>
                       </table>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
              <AnnotationSystem 
                annotations={annotations}
                onSave={handleSaveAnnotations}
                containerRef={coordContainerRef as any}
                isReadOnly={isReadOnly}
                mediaType="document"
                userRole={userRole}
              />
            </div>
          </div>
        )}
        </div>
      </div>

      <style>{`
        .font-lexend { font-family: 'Lexend', sans-serif; }
        .font-luzia { font-family: 'Lora', serif; }

        .ProseMirror {
          color: hsl(var(--muted-foreground));
          font-size: 12px;
          line-height: 1.6;
          outline: none;
        }
        .ProseMirror p { margin: 0 0 1em 0; }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { color: hsl(var(--foreground)); font-weight: 700; }
        
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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }

          .app-root, .app-main, .preview-container { 
            height: auto !important; 
            overflow: visible !important; 
            display: grid !important;
            place-items: center !important;
            grid-template-columns: 100% !important;
            position: static !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }

          .a4-page { 
            box-shadow: none !important; 
            margin: 0 !important; 
            border: none !important; 
            break-after: page !important;
            break-inside: avoid !important;
            display: block !important;
            width: 210mm !important;
            height: 296mm !important; /* Slightly more under 297mm for extra safety */
            position: relative !important;
            background: white !important;
          }
          .a4-page:last-child {
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* Inventory picker — opened from the "From Inventory" button on
          the table footer. Each pick becomes a new invoice line via the
          column-heuristic mapping in onInsertInventoryPicks. */}
      {businessId && (
        <InventoryRowInsertModal
          open={inventoryPickerOpen}
          businessId={businessId}
          onClose={() => setInventoryPickerOpen(false)}
          onInsert={onInsertInventoryPicks}
        />
      )}

      {/* Collaborators Sheet */}
      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients}
        ownerId={docMetadata?.userId || authAction.governance.ownerId || null}
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


interface SortableRowProps {
  id: string;
  row: TableRow;
  idx: number;
  startIndex: number;
  data: DocData;
  isPreview: boolean;
  activeId?: string | null;
  onUpdateCell: (
    rowId: string, // Changed from rowIndex to rowId
    colId: string,
    value: string | number | boolean,
  ) => void;
  onRemoveRow: (targetId: string) => void;
  onAddRowBelow: (targetId: string) => void;
  onAddRowAbove: (targetId: string) => void;
  onAddSectionBelow: (
    targetId: string,
    numbered?: boolean,
    type?: TableRow["rowType"],
  ) => void;
  onAddSectionAbove: (
    targetId: string,
    numbered?: boolean,
    type?: TableRow["rowType"],
  ) => void;
  onAddSubSectionBelow: (
    targetId: string,
    numbered?: boolean,
    type?: TableRow["rowType"],
  ) => void;
  onAddSubSectionAbove: (
    targetId: string,
    numbered?: boolean,
    type?: TableRow["rowType"],
  ) => void;
  useSections: boolean;
  rowNumbering: Record<string, string>;
  isReadOnly: boolean;
  resolveFormula: (
    data: TableRow | Record<string, number>,
    formula: string | undefined,
    context?: Record<string, number>,
  ) => number;
  resolveSectionTotalBackward: (rows: TableRow[], fromIdx: number) => number;
  resolveSectionTotal: (rows: TableRow[], fromIdx: number) => number;
}

const RowActionsMenu: React.FC<{
  onRemove: () => void;
  onAddRowBelow: () => void;
  onAddSectionBelow: () => void;
  onAddSubSectionBelow: () => void;
  onAddTotalBelow: () => void;
  useSections: boolean;
  onAddToDictionary?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
}> = ({
  onRemove,
  onAddRowBelow,
  onAddSectionBelow,
  onAddSubSectionBelow,
  onAddTotalBelow,
  useSections,
  onAddToDictionary,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [openUp, setOpenUp] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const page = menuRef.current.closest(".a4-page");
      if (page) {
        const pageRect = page.getBoundingClientRect();
        const spaceBelow = pageRect.bottom - rect.bottom;
        // The menu is about 230-250px tall
        setOpenUp(spaceBelow < 280);
      }
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-600 hover:text-primary"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[9999] py-1 font-lexend",
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <button
            onClick={() => {
              onAddRowBelow();
              setIsOpen(false);
            }}
            className="flex items-center w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors gap-2"
          >
            <Plus size={12} /> Add Row Below
          </button>
          {useSections && (
            <>
              <button
                onClick={() => {
                  onAddSectionBelow();
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors gap-2"
              >
                <Table size={12} /> Add Section Header
              </button>
              <button
                onClick={() => {
                  onAddSubSectionBelow();
                  setIsOpen(false);
                }}
                className="flex items-center text-left w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors gap-2"
              >
                <Type size={12} /> Add Sub-section Header
              </button>
              <button
                onClick={() => {
                  onAddTotalBelow();
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors gap-2 font-bold text-amber-600"
              >
                <Plus size={12} /> Add Section Total
              </button>
            </>
          )}
          <div className="border-t border-slate-100 my-1" />
          
          {onAddToDictionary && (
            <button
              onClick={() => {
                onAddToDictionary();
                setIsSaved(true);
                setTimeout(() => {
                  setIsSaved(false); // Reset feedback
                  setIsOpen(false); // Close menu
                }, 1000);
              }}
              className="flex items-center text-left w-full px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-colors gap-2"
            >
              <BookOpen size={12} className={cn("transition-transform text-primary", isSaved && "scale-125")} />
              {isSaved ? "Saved to Dictionary!" : "Add to Dictionary"}
            </button>
          )}

          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => {
              onRemove();
              setIsOpen(false);
            }}
            className="flex items-center w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors gap-2"
          >
            <Trash2 size={12} /> Delete Row
          </button>
        </div>
      )}
    </div>
  );
};

const SortableRow: React.FC<SortableRowProps & { activeId?: string | null }> = ({
  id,
  row,
  idx,
  startIndex,
  data,
  isPreview,
  onUpdateCell,
  onRemoveRow,
  onAddRowBelow,
  onAddRowAbove,
  onAddSectionBelow,
  onAddSectionAbove,
  onAddSubSectionBelow,
  onAddSubSectionAbove,
  useSections,
  rowNumbering,
  isReadOnly,
  resolveFormula,
  resolveSectionTotalBackward,
  resolveSectionTotal,
  activeId,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleAddToDictionary = () => {
    if (!row) return;
    
    // 1. Find description
    const allCols = data.table.columns || [];
    const descCol = allCols.find(c => isDescriptionColumn(c, allCols));
    const title = descCol ? String(row[descCol.id] || "") : "";
    
    if (!title.trim()) return;
    
    // 2. Find price
    const priceColId = findPriceColumnId(allCols);
    const price = priceColId ? Number(row[priceColId]) || 0 : 0;
    
    // 3. Find unit
    const unitColId = findUnitColumnId(allCols);
    const unit = unitColId ? String(row[unitColId] || "") : "";
    
    serviceDictionary.add({
      title,
      price,
      unit: unit || undefined,
    });
  };

  const isThisRowBeingDragged = id === activeId;
  const showDropIndicator = isOver && activeId && !isThisRowBeingDragged;
  
  // To keep the layout stable, we ONLY apply transform to the item being dragged.
  // Actually, since we use DragOverlay, we don't even need the original item to move.
  // We just let it stay as a ghost.
  const style = {
    transition,
    opacity: isThisRowBeingDragged ? 0.3 : 1,
    backgroundColor: (startIndex + idx) % 2 === 1 ? "#FBFBFB" : "#fff",
    zIndex: isThisRowBeingDragged ? 100 : (isMenuOpen ? 150 : 10),
    position: "relative" as const,
  };
  const rowNum = rowNumbering[id] || "";

  const DropLine = () => {
    if (!showDropIndicator) return null;
    
    // Determine if line should be top or bottom based on relative indices
    const allRowsArr = data.table.rows || [];
    const activeIndex = allRowsArr.findIndex(r => r.id === activeId);
    const currentIndex = allRowsArr.findIndex(r => r.id === id);
    const isBelow = activeIndex < currentIndex;

    return (
      <div 
        className={cn(
          "absolute left-0 right-0 h-1 bg-primary z-[60] rounded-full",
          isBelow ? "-bottom-0.5" : "-top-0.5"
        )} 
      />
    );
  };

  if (row.rowType === "section-header") {
    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={cn(
          "text-[14px] font-lexend group transition-colors bg-white border-b border-slate-100 relative focus-within:!z-[200] focus-within:relative",
          isThisRowBeingDragged && "shadow-xl border-primary/20 z-10",
        )}
      >
        <DropLine />
        {!isPreview && (
          <td className="w-8 p-1 border-r border-slate-100 no-print">
            <div className="flex items-center justify-center gap-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-primary transition-colors">
                <GripVertical size={14} />
              </div>
              <RowActionsMenu
                onRemove={() => onRemoveRow(id)}
                onAddRowBelow={() => onAddRowBelow(id)}
                onAddSectionBelow={() => onAddSectionBelow(id, true)}
                onAddSubSectionBelow={() => onAddSubSectionBelow(id)}
                onAddTotalBelow={() => onAddSubSectionBelow(id, false, "section-total")}
                useSections={useSections}
                onOpenChange={setIsMenuOpen}
              />
            </div>
          </td>
        )}
        <td
          className="relative h-12 p-3 border-r border-slate-100"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
          <div className="flex items-center justify-center">
            <span className="font-bold text-slate-800">{rowNum}</span>
          </div>
        </td>
        <td
          colSpan={data.table.columns.filter((c) => !c.hidden).length - 1}
          className="p-3 relative overflow-hidden"
        >
          <Editable
            value={row.sectionTitle || "New Section"}
            onSave={(val) =>
              onUpdateCell(id, "sectionTitle", val as string)
            }
            className="text-[14px] font-bold text-slate-900"
            readOnly={isReadOnly}
          />
        </td>
      </tr>
    );
  }

  if (row.rowType === "sub-section-header") {
    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={cn(
          "text-[14px] font-lexend group transition-colors bg-white border-b border-slate-50 relative focus-within:!z-[200] focus-within:relative",
          isThisRowBeingDragged && "shadow-xl border-primary/20 z-10",
        )}
      >
        <DropLine />
        {!isPreview && (
          <td className="w-8 p-1 border-r border-slate-50 no-print">
            <div className="flex items-center justify-center gap-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-primary transition-colors">
                <GripVertical size={14} />
              </div>
              <RowActionsMenu
                onRemove={() => onRemoveRow(id)}
                onAddRowBelow={() => onAddRowBelow(id)}
                onAddSectionBelow={() => onAddSectionBelow(id, true)}
                onAddSubSectionBelow={() => onAddSubSectionBelow(id)}
                onAddTotalBelow={() => onAddSubSectionBelow(id, false, "section-total")}
                useSections={useSections}
                onOpenChange={setIsMenuOpen}
              />
            </div>
          </td>
        )}
        <td
          className="relative h-10 p-3 border-r border-slate-50"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
          <div className="flex items-center justify-center">
            <span className="font-bold">{rowNum}</span>
          </div>
        </td>
        <td
          colSpan={data.table.columns.filter((c) => !c.hidden).length - 1}
          className="p-3 relative overflow-hidden"
        >
          <Editable
            value={row.sectionTitle || "New Sub-section"}
            onSave={(val) =>
              onUpdateCell(id, "sectionTitle", val as string)
            }
            className="text-[13px] font-bold text-slate-800 pl-4"
            readOnly={isReadOnly}
          />
        </td>
      </tr>
    );
  }

  if (row.rowType === "section-total") {
    const totalValue = resolveSectionTotalBackward(data.table.rows, startIndex + idx);
    // Derive label from the nearest section-header above this row
    let parentSectionTitle = "";
    for (let i = startIndex + idx - 1; i >= 0; i--) {
      const r = data.table.rows[i];
      if (r.rowType === "section-header" || r.rowType === "sub-section-header") {
        parentSectionTitle = (r.sectionTitle as string) || "";
        break;
      }
    }
    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={cn(
          "text-[14px] font-lexend group transition-colors bg-amber-100/40 border-b border-amber-200/50 relative focus-within:!z-[200] focus-within:relative",
          isThisRowBeingDragged && "shadow-xl border-primary/20 z-10",
        )}
      >
        <DropLine />
        {!isPreview && (
          <td className="w-8 p-1 border-r border-amber-200/50 no-print">
            <div className="flex items-center justify-center gap-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-amber-600/70 hover:text-primary transition-colors">
                <GripVertical size={14} />
              </div>
              <RowActionsMenu
                onRemove={() => onRemoveRow(id)}
                onAddRowBelow={() => onAddRowBelow(id)}
                onAddSectionBelow={() => onAddSectionBelow(id)}
                onAddSubSectionBelow={() => onAddSubSectionBelow(id, false)}
                onAddTotalBelow={() => onAddSubSectionBelow(id, false, "section-total")}
                useSections={useSections}
                onOpenChange={setIsMenuOpen}
              />
            </div>
          </td>
        )}
        <td
          className="relative h-12 p-3 border-r border-amber-200/50"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
        </td>
        <td
          colSpan={data.table.columns.filter((c) => !c.hidden).length - 2}
          className="p-3"
        >
          <span className="text-[13px] font-bold text-amber-900/80">
            {parentSectionTitle ? `${parentSectionTitle} Total` : "Section Total"}
          </span>
        </td>
        <td className="p-3 font-bold text-slate-900 bg-amber-100/60">
          ₦{Math.round(totalValue).toLocaleString()}
        </td>
      </tr>
    );
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-[14px] text-[#212121] border-b border-slate-50 font-lexend group transition-colors relative focus-within:!z-[200] focus-within:relative",
        isThisRowBeingDragged && "shadow-xl border-primary/20 z-10",
      )}
    >
      <DropLine />
      {(data.table.columns || [])
        .filter((c) => !c.hidden)
        .map((col: any, colIdx) => {
          if (col.type === "index") {
            return (
              <React.Fragment key={col.id}>
                {!isPreview && (
                  <td className="w-8 p-1 border-r border-slate-100 no-print">
                    <div className="flex items-center justify-center gap-1">
                      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-primary transition-colors">
                        <GripVertical size={14} />
                      </div>
                      <RowActionsMenu
                        onRemove={() => onRemoveRow(id)}
                        onAddRowBelow={() => onAddRowBelow(id)}
                        onAddSectionBelow={() => onAddSectionBelow(id, true)}
                        onAddSubSectionBelow={() => onAddSubSectionBelow(id)}
                        onAddTotalBelow={() => onAddSubSectionBelow(id, false, "section-total")}
                        useSections={useSections}
                        onAddToDictionary={handleAddToDictionary}
                        onOpenChange={setIsMenuOpen}
                      />
                    </div>
                  </td>
                )}
                <td
                  className="relative h-10 p-3 border-r border-slate-100"
                  style={{ width: col.width || "auto" }}
                >
                  <div className="flex items-center justify-center">
                    <span className="font-bold">{rowNum}</span>
                  </div>
                </td>
              </React.Fragment>
            );
          }

          const cellId = col.id;
          const isNumeric = col.type === "number";
          const isFormula = col.type === "formula";

          let value = row[cellId];
          if (isFormula) {
            value = resolveFormula(row, col.formula);
          }

          const isDescription = isDescriptionColumn(col, data.table.columns || []);

          return (
            <td
              key={col.id}
              className={cn(
                "p-3 border-r border-slate-50 last:border-r-0 relative h-10",
                (isNumeric || isFormula) && "text-left font-lexend text-medium",
              )}
              style={{ width: col.width || "auto" }}
            >
              {isFormula ? (
                <span className="opacity-80">
                  {typeof value === "number"
                    ? Math.round(value).toLocaleString()
                    : value}
                </span>
              ) : (
                <Editable
                  className={cn(
                    "w-full",
                    (isNumeric || isFormula) && "text-left font-lexend",
                  )}
                  value={value as string | number}
                  numeric={isNumeric}
                  onChange={(val) => onUpdateCell(row.id as string, col.id, val)}
                  onSave={(val) => onUpdateCell(row.id as string, col.id, val)}
                  readOnly={isReadOnly}
                  getSuggestions={isDescription ? (q) => serviceDictionary.search(q) : undefined}
                  onPickSuggestion={isDescription ? (entry) => {
                    // 1. Find price column and update it
                    const priceColId = findPriceColumnId(data.table.columns || []);
                    if (priceColId) {
                      onUpdateCell(row.id as string, priceColId, entry.price);
                    }
                    // 2. Find unit column and update it
                    const unitColId = findUnitColumnId(data.table.columns || []);
                    if (unitColId && entry.unit) {
                      onUpdateCell(row.id as string, unitColId, entry.unit);
                    }
                  } : undefined}
                />
              )}
            </td>
          );
        })}
    </tr>
  );
};

const A4Page: React.FC<A4PageProps> = ({
  data,
  rows,
  pageIndex,
  totalPrice,
  headerImage,
  headerHeight,
  onHeaderResize,
  isFirstPage,
  isLastPage,
  startIndex,
  onUpdateContact,
  onUpdateTitle,
  onUpdateCell,
  onRemoveRow,
  onAddRowBelow,
  onAddRowAbove,
  onAddSectionBelow,
  onAddSectionAbove,
  onAddSubSectionBelow,
  onAddSubSectionAbove,
  onMoveRow,
  resolveFormula,
  onUpdateInvoiceCode,
  onUpdateSummaryItem,
  onUpdateDate,
  showRows,
  showTotals,
  showFooter,
  isPreview,
  isEndOfRows,
  rowNumbering: rowNumbering,
  resolveSectionTotalBackward,
  useSections,
  resolveSectionTotal,
  onUpdatePaymentMethod,
  onUpdateTransactionId,
  onUpdateReference,
  onUpdateSignature,
  onUpdateReceiptMessage,
  isReadOnly,
  rowsLength,
  lastUpdated,
  activeId,
  onOpenInventoryPicker,
}) => {
  const HEADER_DARK_BROWN = "#503D36";
  const PRIMARY_BROWN = "#8D6E63";
  const ADDRESS_BG = "#F8F8F8";

  const ColumnHeader: React.FC<{
    col: any;
    onResize: (width: string) => void;
    isReadOnly: boolean;
  }> = ({ col, onResize, isReadOnly }) => {
    const [isResizing, setIsResizing] = React.useState(false);
    const headRef = React.useRef<HTMLTableHeaderCellElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (isReadOnly) return;
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = headRef.current?.offsetWidth || 0;

      const handleMouseMove = (em: MouseEvent) => {
        const deltaX = em.clientX - startX;
        const newWidth = Math.max(40, startWidth + deltaX);
        onResize(`${newWidth}px`);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    return (
      <th
        ref={headRef}
        className="p-4 font-normal text-left border-r border-white/10 last:border-r-0 relative group"
        style={{ width: col.width || "auto" }}
      >
        <span className="relative z-10">{col.label}</span>
        {!isReadOnly && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-20 transition-all",
              "hover:bg-primary/40",
              isResizing && "bg-primary w-[3px] shadow-[0_0_8px_rgba(var(--primary),0.6)]"
            )}
          />
        )}
      </th>
    );
  };

  const BOQSummary = () => {
    if (!data.showBOQSummary) return null;
    const sections = (data.table.rows || []).filter(r => r.rowType === "section-header" || r.rowType === "sub-section-header");
    if (sections.length === 0) return null;

    return (
      <div className="mb-10 w-full animate-in fade-in slide-in-from-top-4 duration-700">
        <h2 className="text-center font-lora text-[18px] uppercase tracking-[0.2em] text-[#503D36] mb-6">
          Summary of Bill of Quantity
        </h2>
        <div className="overflow-hidden border border-[#E5D3C8] rounded-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#E5D3C8] text-[#503D36] text-[11px] font-bold uppercase tracking-[0.15em]">
                <th className="p-3 text-left w-12 border-r border-white/20">#</th>
                <th className="p-3 text-left border-r border-white/20">Description</th>
                <th className="p-3 text-right">Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, idx) => {
                const total = resolveSectionTotal(data.table.rows, data.table.rows.indexOf(section));
                return (
                  <tr key={section.id || `sect-${idx}`} className={cn(
                    "text-[12px] font-lexend border-b border-[#F5EDE8]",
                    idx % 2 === 0 ? "bg-white" : "bg-[#FBF9F7]"
                  )}>
                    <td className="p-3 font-bold text-slate-400 border-r border-[#F5EDE8]">{String.fromCharCode(65 + idx)}</td>
                    <td className="p-3 font-bold text-slate-800 border-r border-[#F5EDE8] uppercase">{section.sectionTitle}</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      ₦{Math.round(total).toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {(totalPrice?.grandTotal !== undefined) && (
                <>
                  <tr className="bg-[#F8F9FA] text-[12px] font-lexend border-b border-[#E5D3C8]">
                    <td colSpan={2} className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right border-r border-[#E5D3C8]">Sub Total</td>
                    <td className="p-3 text-right font-black text-slate-900 bg-white">
                      ₦{Math.round(totalPrice.subTotal).toLocaleString()}
                    </td>
                  </tr>
                  {(totalPrice.summaries || []).map((item: any, sidx: number) => (
                    <tr key={item.id || sidx} className="bg-[#F8F9FA] text-[12px] font-lexend border-b border-[#E5D3C8]">
                      <td colSpan={2} className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right border-r border-[#E5D3C8]">{item.label}</td>
                      <td className="p-3 text-right font-black text-slate-900 bg-white">
                        ₦{Math.round(item.calculatedValue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="text-white text-[13px] font-lexend" style={{ backgroundColor: PRIMARY_BROWN }}>
                    <td colSpan={2} className="p-4 font-bold uppercase tracking-[0.15em] text-right border-r border-white/10">Grand Total</td>
                    <td className="p-4 text-right font-black text-[15px]">
                      ₦{Math.round(totalPrice.grandTotal).toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 relative overflow-hidden shrink-0 focus-within:z-[50] focus-within:relative"
      style={{
        width: "210mm",
        height: "297mm",
        maxHeight: "297mm",
        padding: "14mm 8mm 20mm 8mm",
        backgroundColor: "#FFFFFF",
      }}
    >
      {isFirstPage && (
        <div
          className="flex items-center justify-center overflow-hidden border-b border-slate-100"
          style={{
            // Bleed exactly to the A4 page edges. Page padding is 8mm horizontal
            // and 14mm top — anything beyond would overflow the page frame.
            margin: "-15mm -8mm 10mm -8mm",
            width: "calc(100% + 16mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          <img
            src={data.isReceipt ? "/Shan-PaymentReceipt.png" : "/Shan-Invoice.png"}
            alt="Logo"
            className="object-cover object-center w-full h-full"
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 h-2 bg-transparent cursor-ns-resize no-print"
            onMouseDown={onHeaderResize}
          />
        </div>
      )}

      {isFirstPage && (
        <>
          <div className="mb-8 flex items-center justify-between text-[14px] font-normal text-[#212121] font-lexend">
            <div className="opacity-80 relative h-[1.5em] overflow-hidden">
              <Editable
                value={data.date}
                onSave={(val) => onUpdateDate(val as string)}
                isDate={true}
                readOnly={isReadOnly}
              />
            </div>
            {data.invoiceCode && (
              <div className="font-bold text-[15px] whitespace-nowrap min-w-[100px]" style={{ color: data.invoiceCode.color }}>
                <Editable 
                  value={data.invoiceCode.text} 
                  onSave={(val) => onUpdateInvoiceCode({ text: val as string })} 
                  readOnly={isReadOnly}
                />
              </div>
            )}
          </div>

          <div
            className="flex justify-between px-4 py-8 mb-12"
            style={{ backgroundColor: ADDRESS_BG }}
          >
            <div className="flex flex-col items-start w-1/2 font-lexend">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">
                Attention To:
              </span>
              <div className="w-full relative h-[1.5em] mb-1 overflow-hidden">
                <Editable
                  className="font-normal text-[#212121] text-[15px] uppercase"
                  value={data.contact.name}
                  onSave={(val) => onUpdateContact("name", val as string)}
                  readOnly={isReadOnly}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address1}
                  onSave={(val) => onUpdateContact("address1", val as string)}
                  readOnly={isReadOnly}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address2}
                  onSave={(val) => onUpdateContact("address2", val as string)}
                  readOnly={isReadOnly}
                />
              </div>
            </div>

            <div className="flex flex-col items-start w-1/2 pl-12 text-left border-l font-lexend border-slate-200">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">
                {data.isReceipt ? "Ref:" : "Billed From:"}
              </span>
              {data.isReceipt ? (
                <div className="w-full relative min-h-[1.5em]">
                  <Editable 
                    value={data.reference || ""} 
                    onSave={(val) => onUpdateReference(val as string)}
                    multiline={true}
                    className="w-full text-left font-normal text-[#212121] text-[12px]"
                    readOnly={isReadOnly}
                  />
                </div>
              ) : (
                <>
                  <div className="font-normal text-[#212121] mb-1 text-[12px]">
                    B3F3, The Genesis Estate, Off Odobo Street,
                  </div>
                  <div className="font-normal text-[12px] opacity-90">
                    Ogba-Ikeja, Lagos.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center mb-10 text-center uppercase tracking-widest text-[18px] font-medium leading-[139.4%] text-[#212121]">
            <div className="w-[500px] relative min-h-[1.5em] max-h-20 overflow-y-auto custom-scrollbar">
              <Editable
                className="w-full h-full"
                multiline={true}
                value={data.title}
                onSave={(val) => onUpdateTitle(val as string)}
                readOnly={isReadOnly}
              />
            </div>
          </div>
        </>
      )}

      {isFirstPage && <BOQSummary />}

      {showRows && (
        <div className="overflow-hidden border border-slate-100">
          <table className="w-full border-collapse">
            <thead>
                <tr
                  className="text-white text-[13px] font-normal uppercase tracking-[0.2em] font-luzia"
                  style={{ backgroundColor: HEADER_DARK_BROWN }}
                >
                  {!isPreview && <th className="p-4 w-8 border-r border-white/10 no-print" />}
                  {(data.table.columns || [])
                    .filter((c) => !c.hidden)
                    .map((col: any) => (
                      <ColumnHeader
                        key={col.id}
                        col={col}
                        isReadOnly={!!isReadOnly}
                        onResize={(width) => {
                          const target = data.table.columns.find(c => c.id === col.id);
                          if (target) target.width = width;
                        }}
                      />
                    ))}
                </tr>
            </thead>
            <tbody>
                {(rows || []).map((row, idx) => (
                  <SortableRow
                    key={row.id || `row-${startIndex}-${idx}`}
                    id={row.id || `row-${startIndex}-${idx}`}
                    row={row}
                    idx={idx}
                    startIndex={startIndex}
                    data={data}
                    isPreview={isPreview}
                    onUpdateCell={onUpdateCell}
                    onRemoveRow={onRemoveRow}
                    onAddRowBelow={onAddRowBelow}
                    onAddRowAbove={onAddRowAbove}
                    onAddSubSectionBelow={onAddSubSectionBelow}
                    onAddSubSectionAbove={onAddSubSectionAbove}
                    onAddSectionBelow={onAddSectionBelow}
                    onAddSectionAbove={onAddSectionAbove}
                    useSections={useSections}
                    rowNumbering={rowNumbering}
                    resolveFormula={resolveFormula}
                    resolveSectionTotalBackward={resolveSectionTotalBackward}
                    resolveSectionTotal={resolveSectionTotal}
                    isReadOnly={!!isReadOnly}
                    activeId={activeId}
                  />
                ))}
            </tbody>
          </table>
          {!isReadOnly && isEndOfRows && (
            <div className="p-4 border-t border-slate-50 bg-[#FBFBFB]/50 flex justify-center items-center gap-2 no-print">
              <button
                onClick={() => {
                  const lastRow = rows[rows.length - 1];
                  if (lastRow) onAddRowBelow(lastRow.id as string);
                  else {
                    // Fallback for empty table
                    if (data) {
                      const newRow = { id: crypto.randomUUID(), rowType: "row" };
                      data.table.rows.push(newRow as any);
                    }
                  }
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus
                  size={14}
                  className="transition-transform duration-300 group-hover:rotate-90"
                />
                Add New Row
              </button>
              {onOpenInventoryPicker && (
                <button
                  onClick={onOpenInventoryPicker}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Pick items from your inventory catalog and insert them as rows"
                >
                  <Boxes size={14} />
                  From Inventory
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showTotals && totalPrice && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow
            label="Sub Total"
            value={totalPrice.subTotal}
            readOnly
            className="bg-slate-100/50 font-bold"
          />
          {(totalPrice.summaries || []).map((item: any) => (
            <TotalRow
              key={item.id}
              label={item.label}
              value={item.calculatedValue || 0}
              onSaveLabel={(val) => onUpdateSummaryItem(item.id, val)}
              readOnly={isReadOnly}
            />
          ))}
          <div
            className="flex items-center justify-between p-2 px-5 text-white"
            style={{ backgroundColor: PRIMARY_BROWN }}
          >
            <span className="text-[14px] font-normal tracking-wide font-lexend uppercase">
              {data.isReceipt ? "Total Amount Paid" : "Grand Total"}
            </span>
            <span className="text-[18px] font-bold font-lexend">
              ₦{Math.round(totalPrice.grandTotal).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {showFooter && (
        <div className="mt-8">
          {data.isReceipt ? (
            <div className="flex justify-between items-end border-t border-slate-100 pt-8 px-4">
               {/* Left: Thank You & Payment Method */}
                <div className="flex flex-col gap-6 max-w-[50%]">
                  <div className="text-[14px] font-medium text-slate-800 italic font-lexend min-h-[1.5em] max-h-16 relative custom-scrollbar w-full">
                    <Editable
                      value={data.receiptMessage || "Thank you for your patronage!"}
                      onSave={(val) => onUpdateReceiptMessage(val as string)}
                      multiline={true}
                      className="w-full text-left"
                      readOnly={isReadOnly}
                    />
                  </div>
                 <div className="flex flex-row gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-lexend">Payment Method</span>
                    <span className="text-[8px] uppercase tracking-widest text-slate-400 font-normal font-lexend">Bank Transfer | Cash | POS | Cheque</span>
                    <div className="text-[13px] font-lexend text-slate-700 h-[1.5em] overflow-hidden relative">
                      <Editable
                        value={data.paymentMethod || "Transfer"}
                        onSave={(val) => onUpdatePaymentMethod(val as string)}
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-lexend">Transaction ID</span>
                    <div className="text-[13px] font-lexend text-slate-700 h-[1.5em] overflow-hidden relative">
                      <Editable
                        value={data.transactionId || "TRX-000000000"}
                        onSave={(val) => onUpdateTransactionId(val as string)}
                        readOnly={isReadOnly}
                      />
                    </div>
                    </div>
                  </div>
               </div>

               {/* Right: Signature Area */}
               <div className="flex flex-col items-center gap-3 min-w-[200px]">
                  <div
                    className={cn(
                      "w-48 h-20 border-b-2 border-slate-200 relative flex items-center justify-center group/sign cursor-pointer overflow-hidden transition-all",
                      !data.signature && !isPreview && "hover:bg-slate-50 border-dashed"
                    )}
                    onClick={() => {
                      if (isPreview) return;
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            onUpdateSignature(re.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {data.signature ? (
                      <img src={data.signature} alt="Authorized Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    ) : (
                      !isPreview && <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest group-hover/sign:text-primary transition-colors text-center px-4">Click to Upload Signature</div>
                    )}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#503D36] font-lexend">Authorized Signature</span>
               </div>
            </div>
          ) : (
            <>
              {data.footer.notes && (
                <div className="p-4 border rounded bg-slate-50 border-slate-200">
                  <div
                    className="text-[14px] font-normal text-[#212121] font-lexend leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: data.footer.notes }}
                  />
                </div>
              )}

              {data.footer.emphasis &&
                Array.isArray(data.footer.emphasis) &&
                data.footer.emphasis.length > 0 && (
                  <div className="mt-4 bg-[#EDEDED] px-8 py-5 flex flex-col gap-1.5">
                    {data.footer.emphasis.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="uppercase text-[12px] tracking-widest text-[#7A7672] font-black">
                          {item.key}:
                        </span>
                        <span className="text-[17px] font-bold tracking-wide text-[#4B4032]">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      )}

      <div className="absolute left-0 w-full px-16 text-center bottom-10">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[11px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Maintenance Proposal 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Quality Works Guaranteed</span>
        </div>
      </div>
    </div>
  );
};

const TotalRow = ({
  label,
  value,
  onSaveLabel,
  readOnly = false,
  className,
}: {
  label: string;
  value: number;
  onSaveLabel?: (val: string) => void;
  readOnly?: boolean;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex justify-between items-center p-4 text-[14px] font-normal border-b border-slate-70 font-lexend h-12",
        className,
      )}
    >
      <div className="text-slate-500 uppercase text-[11px] tracking-[0.2em] min-w-[120px] relative h-full overflow-hidden flex items-center">
        {onSaveLabel ? (
          <Editable
            value={label}
            onSave={(val) => onSaveLabel(val as string)}
            readOnly={readOnly}
          />
        ) : (
          <span>{label}</span>
        )}
      </div>
      <span className="text-[#212121]">
        ₦{Math.round(value).toLocaleString()}
      </span>
    </div>
  );
};

export default Editor;
