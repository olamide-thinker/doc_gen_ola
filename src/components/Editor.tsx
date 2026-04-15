import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Eye
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
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

import { AnnotationSystem } from "./AnnotationSystem";
import { A4PageProps } from "./A4PageProps";
import { Annotation, DocumentMember, MemberRole, canWrite } from "../types";
import { Radio, SignalIcon } from "lucide-react";

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

  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);
  // Real-time collaborative document content — shared across every client
  // connected to the `doc-{id}` Hocuspocus room.
  const editorAction = useSyncedStore(editorStore);
  const { user: currentUser, businessId, businessName: ctxBusinessName, projectId } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
    () => localStorage.getItem("headerImage") || "/Shan-Invoice.png",
  );
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );
  const [isPreview, setIsPreview] = useState(false);
  const [rawInput, setRawInput] = useState<string>("");
  const [history, setHistory] = useState<DocData[]>([]);
  const [future, setFuture] = useState<DocData[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    return !canWrite(userRole);
  }, [isPreview, userRole, docMetadata?.status]);

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
  }, [id, isSyncReady]);


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
      const updatedRows = docData.table.rows.map((r) =>
        r.id ? r : { ...r, id: crypto.randomUUID() },
      );
      updateDocData({
        ...docData,
        table: { ...docData.table, rows: updatedRows },
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

  const onMoveRow = (targetId: string, dir: "up" | "down") => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const target = dir === "up" ? i - 1 : i + 1;
      if (target < 0 || target >= docData.table.rows.length) return;
      const [movedItem] = docData.table.rows.splice(i, 1);
      docData.table.rows.splice(target, 0, movedItem);
    }
  };

  const onAddSectionBelow = (targetId: string, numbered?: boolean) => {
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
  };

  const onAddSectionAbove = (targetId: string, numbered?: boolean) => {
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
  };

  const onRemoveRow = (targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i !== -1) {
        docData.table.rows.splice(i, 1);
      }
    }
  };

  const onAddSubSectionBelow = (targetId: string, numbered?: boolean, type?: TableRow["rowType"]) => {
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
  };

  const onAddSubSectionAbove = (targetId: string, numbered?: boolean, type?: TableRow["rowType"]) => {
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
  };

  const onAddRowBelow = (targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const newRow: TableRow = { id: crypto.randomUUID(), rowType: "row" };
      docData.table.columns.forEach((col) => {
        if (col.type === "index") return;
        newRow[col.id] = col.type === "number" ? 0 : "";
      });
      docData.table.rows.splice(i + 1, 0, newRow as any);
    }
  };

  const onAddRowAbove = (targetId: string) => {
    if (docData) {
      const i = docData.table.rows.findIndex((r: any) => r.id === targetId);
      if (i === -1) return;
      const newRow: TableRow = { id: crypto.randomUUID(), rowType: "row" };
      docData.table.columns.forEach((col) => {
        if (col.type === "index") return;
        newRow[col.id] = col.type === "number" ? 0 : "";
      });
      docData.table.rows.splice(i, 0, newRow as any);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && docData) {
      const oldIndex = docData.table.rows.findIndex((r) => r.id === active.id);
      const newIndex = docData.table.rows.findIndex((r) => r.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const item = docData.table.rows[oldIndex];
        docData.table.rows.splice(oldIndex, 1);
        docData.table.rows.splice(newIndex, 0, item);
      }
    }
  };

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && docData) {
      const oldIndex = docData.table.summary.findIndex(
        (s) => s.id === active.id,
      );
      const newIndex = docData.table.summary.findIndex(
        (s) => s.id === over?.id,
      );
      if (oldIndex !== -1 && newIndex !== -1) {
        const item = docData.table.summary[oldIndex];
        docData.table.summary.splice(oldIndex, 1);
        docData.table.summary.splice(newIndex, 0, item);
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


  const getLetterId = (idx: number) => String.fromCharCode(65 + idx);

  const { subTotal, summaries, grandTotal } = 
    docData ? computeTotalPrice(docData) : { subTotal: 0, summaries: [], grandTotal: 0 };

  const totalPriceObj: TotalPrice = {
    subTotal,
    summaries,
    grandTotal,
  };

  const resolveSectionTotalBackwardWrapper = (rows: TableRow[], fromIdx: number) => 
    docData ? resolveSectionTotalBackward(rows, fromIdx, docData) : 0;
  
  const resolveSectionTotalWrapper = (rows: TableRow[], fromIdx: number) => 
    docData ? resolveSectionTotal(rows, fromIdx, docData) : 0;

  const summaryForRender = summaries;

  const rowNumbering = useMemo(
    () => getRowNumbering(docData?.table.rows || [], useSections),
    [docData?.table.rows, useSections],
  );

  const pages = useMemo(
    () => (docData ? calculateChunks(docData, headerHeight, useSections) : []),
    [docData, headerHeight, useSections],
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

  if (isLoadingDoc || !docData)
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        <RefreshCw className="animate-spin text-muted-foreground/30" size={32} />
      </div>
    );

  // Removed Access Denied guard to restore editability

  const onUpdateContact = (field: keyof Contact, value: string) => {
    if (docData) docData.contact[field] = value;
  };

  const onUpdateTitle = (value: string) => {
    if (docData) docData.title = value;
  };

  const onUpdateCell = (
    rowId: string, // Changed from rowIndex to rowId
    colId: string,
    value: string | number | boolean,
  ) => {
    if (!docData) return;
    
    // 1. Find the exact row by ID, not index
    const row = docData.table.rows.find((r: any) => r.id === rowId);
    if (!row) return;

    // 2. Check if the column is meant to be a number
    const column = docData.table.columns.find((c: any) => c.id === colId);
    const isNumeric = column?.type === "number";

    // 3. Mutate the SyncedStore proxy directly and cast numbers!
    if (isNumeric) {
      const parsed = parseFloat(value as string);
      row[colId] = isNaN(parsed) ? 0 : parsed;
    } else {
      row[colId] = value;
    }
  };

  const onUpdateSummaryItem = (id: string, label: string) => {
    if (docData) {
      const item = docData.table.summary.find((s) => s.id === id);
      if (item) item.label = label;
    }
  };

  const onUpdateDate = (v: string) => {
    if (docData) docData.date = v;
  };

  const onUpdatePaymentMethod = (v: string) => {
    if (docData) docData.paymentMethod = v;
  };

  const onUpdateTransactionId = (v: string) => {
    if (docData) docData.transactionId = v;
  };

  const onUpdateReference = (v: string) => {
    if (docData) docData.reference = v;
  };

  const onUpdateSignature = (v: string) => {
    if (docData) docData.signature = v;
  };

  const onUpdateReceiptMessage = (v: string) => {
    if (docData) docData.receiptMessage = v;
  };

  const pagesToDisplay = pages;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      <header className="h-14 border-b border-border bg-card flex items-center gap-2 px-6 shrink-0 shadow-sm z-30 transition-colors duration-300">
        <button
          onClick={() => navigate(fromFolder ? `/dashboard?folder=${fromFolder}` : "/dashboard")}
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
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
            <SignalIcon size={10} className="text-success animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auto Saved</span>
          </div>


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

          <button
            onClick={() => {
              navigate(`/invoice/${id}`);
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 active:scale-95"
          >
            <Check size={14} /> Finish Editing
          </button>
        </div>
      </header>

      {isReadOnly && !isPreview && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-warning">
          <Eye size={12} /> View-only — your role ({userRole}) cannot edit this document
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
          className="flex-1 relative overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar flex flex-col items-center"
        >
          {/* Relative wrapper for content-anchored annotations */}
          <div ref={contentRef} className="relative w-full flex flex-col items-center min-h-full">

            {/* Coordinate-stable container for document and annotations */}
            <div ref={coordContainerRef} className="relative w-fit flex flex-col items-center">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={(docData?.table.rows || []).map(r => r.id as string)}
                  strategy={verticalListSortingStrategy}
                >
                  {pages.map((page, pageIndex) => (
                    <A4Page
                      key={pageIndex}
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
                      isPreview={isPreview}
                      isReadOnly={isReadOnly}
                    />
                  ))}
                </SortableContext>
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
  onOpenChange?: (isOpen: boolean) => void;
}> = ({
  onRemove,
  onAddRowBelow,
  onAddSectionBelow,
  onAddSubSectionBelow,
  onAddTotalBelow,
  useSections,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

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
        className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-primary"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[9999] py-1 font-lexend">
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

const SortableRow: React.FC<SortableRowProps> = ({
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: (startIndex + idx) % 2 === 1 ? "#FBFBFB" : "#fff",
    zIndex: isDragging ? 100 : (isMenuOpen ? 50 : 1),
    position: "relative" as const,
  };
  const rowNum = rowNumbering[id] || "";

  if (row.rowType === "section-header") {
    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={cn(
          "text-[14px] font-lexend group transition-colors bg-white border-b border-slate-100 relative",
          isDragging &&
            "shadow-xl border-primary/20 z-50 ring-1 ring-primary/10",
          isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50",
        )}
      >
        <td
          className="relative h-12 p-3 border-r border-slate-100"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
          <div className="flex items-center justify-center gap-1">
            {!isPreview && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors no-print"
              >
                <GripVertical size={12} className="text-slate-300" />
              </div>
            )}
            <span className="font-bold text-slate-800">{rowNum}</span>
          </div>
          {!isPreview && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-50 no-print">
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
          )}
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
          "text-[14px] font-lexend group transition-colors bg-white border-b border-slate-50 relative",
          isDragging &&
            "shadow-xl border-primary/20 z-50 ring-1 ring-primary/10",
          isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50",
        )}
      >
        <td
          className="relative h-10 p-3 border-r border-slate-50"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
          <div className="flex items-center justify-center gap-1">
            {!isPreview && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors no-print"
              >
                <GripVertical size={12} className="text-slate-300" />
              </div>
            )}
            <span className="font-bold">{rowNum}</span>
          </div>
          {!isPreview && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-50 no-print">
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
          )}
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
          "text-[14px] font-lexend group transition-colors bg-amber-100/40 border-b border-amber-200/50 relative",
          isDragging &&
            "shadow-xl border-primary/20 z-50 ring-1 ring-primary/10",
          isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50",
        )}
      >
        <td
          className="relative h-12 p-3 border-r border-amber-200/50"
          style={{
            width:
              data.table.columns.find((c) => c.type === "index")?.width || 50,
          }}
        >
          <div className="flex items-center justify-center gap-1">
            {!isPreview && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors no-print"
              >
                <GripVertical size={12} className="text-amber-300" />
              </div>
            )}
          </div>
          {!isPreview && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-50 no-print">
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
          )}
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
        "text-[14px] text-[#212121] border-b border-slate-50 font-lexend group transition-colors relative",
        isDragging && "shadow-xl border-primary/20 z-50 ring-1 ring-primary/10",
        isOver && !isDragging && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:z-50",
      )}
    >
      {(data.table.columns || [])
        .filter((c) => !c.hidden)
        .map((col: any) => {
          if (col.type === "index") {
            return (
              <td
                key={col.id}
                className="relative h-10 p-3 border-r border-slate-100"
                style={{ width: col.width }}
              >
                <div
                  {...attributes}
                  {...listeners}
                  className={cn(
                    "cursor-grab active:cursor-grabbing flex items-center justify-center gap-1 hover:text-primary transition-colors w-full",
                    isPreview && "pointer-events-none",
                  )}
                >
                  <GripVertical
                    size={12}
                    className="transition-opacity text-slate-300 no-print"
                  />
                  <span className="font-bold">{rowNum}</span>
                </div>

                {!isPreview && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-50 no-print">
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
                )}
              </td>
            );
          }

          const cellId = col.id;
          const isNumeric = col.type === "number";
          const isFormula = col.type === "formula";

          let value = row[cellId];
          if (isFormula) {
            value = resolveFormula(row, col.formula);
          }

          return (
            <td
              key={col.id}
              className={cn(
                "p-3 border-r border-slate-50 last:border-r-0 relative h-10 overflow-hidden",
                (isNumeric || isFormula) && "text-left font-lexend text-medium",
              )}
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
}) => {
  const HEADER_DARK_BROWN = "#503D36";
  const PRIMARY_BROWN = "#8D6E63";
  const ADDRESS_BG = "#F8F8F8";

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
                  <tr key={section.id} className={cn(
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
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 relative overflow-hidden shrink-0"
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
            margin: "-15mm -20mm 10mm -20mm",
            width: "calc(100% + 40mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          <img
            src={data.isReceipt ? "/Shan-PaymentReceipt.png" : "/Shan-Invoice.png"}
            alt="Logo"
            className="object-contain object-center w-full h-full"
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
                {(data.table.columns || [])
                  .filter((c) => !c.hidden)
                  .map((col: any) => (
                    <th
                      key={col.id}
                      className="p-4 font-normal text-left border-r border-white/10 last:border-r-0"
                      style={{ width: col.width || "auto" }}
                    >
                      {col.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
                {(rows || []).map((row, idx) => (
                  <SortableRow
                    key={row.id as string}
                    id={row.id as string}
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
                  />
                ))}
            </tbody>
          </table>
          {!isReadOnly && isEndOfRows && (
            <div className="p-4 border-t border-slate-50 bg-[#FBFBFB]/50 flex justify-center no-print">
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
                Add New Line Item
              </button>
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
