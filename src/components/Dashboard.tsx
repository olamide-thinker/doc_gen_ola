import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Folder, 
  FileText, 
  Check,
  ShieldCheck,
  X,
  Plus, 
  Search, 
  MoreHorizontal, 
  LayoutGrid, 
  List, 
  Clock, 
  Trash, 
  Copy, 
  Edit,
  ArrowLeft,
  UserIcon,
  RefreshCw,
  Table,
  Type,
  Sun,
  Moon,
  Pin,
  PinOff,
  Users,
  Shield,
  AlertTriangle,
  LogOut,
  Boxes,
  Calculator,
  ScrollText,
  Image as ImageIcon,
  Video,
  Eye,
} from "../lib/icons/lucide";
import { DocumentMember, MemberRole } from "../types";
import { cn } from "../lib/utils";
import { api, initializeWorkspace, isPlayground, getPlaygroundId } from "../lib/api";
import { type WorkspaceFolder as FolderType, type WorkspaceDocument as DocumentType } from "../store";
import { type TemplateDefinition, TEMPLATES } from "../lib/templates";
import { type InvoiceCode } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentThumbnail } from "./Thumbnail";
import { CardDocumentPreview } from "./CardDocumentPreview";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, uiStore, connectProject, workspaceProvider, authProvider } from "../store";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { EditTemplateModal } from "./EditTemplateModal";
import CreateInvoiceModal, { type CreateInvoiceFormData } from "./CreateInvoiceModal";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { CreateProjectModal } from "./CreateProjectModal";
import { TemplatePickerModal } from "./TemplatePickerModal";
import { MemberManagementModal } from "./MemberManagementModal";
import { FileViewerModal } from "./FileViewerModal";
import { FileAttachment } from "../types";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const uiAction = useSyncedStore(uiStore);
  const viewMode = uiAction.settings.viewMode || 'grid';
  const searchQuery = uiAction.settings.searchQuery || '';
  const isSearching = searchQuery.length > 0;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDefinition | null>(null);
  const [createModal, setCreateModal] = useState<{ open: boolean; template?: TemplateDefinition }>({ open: false });
  const [clipboard, setClipboard] = useState<{ id: string, name: string, type: 'document' | 'folder' } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [memberModal, setMemberModal] = useState<{ open: boolean; type: 'project' | 'folder' | 'document'; id: string; name: string; members: (string | DocumentMember)[]; isOwner?: boolean } | null>(null);
  
  const [activeModule, setActiveModule] = useState<"documents" | "inventory" | "accounting">("documents");
  const [activeView, setActiveView] = useState<"home" | "templates">("home");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileAttachment | null>(null);
  const [viewingFileDocId, setViewingFileDocId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingItem, setRenamingItem] = useState<any>(null);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  
  const { user: currentUser, logout, businessId, businessName: authBusinessName, projectId: activeProjectId, setProject, role, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [businessName, setBusinessName] = useState(authBusinessName || "Your Business");
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (authBusinessName) {
      setBusinessName(authBusinessName);
    }
  }, [authBusinessName]);

  const params = new URLSearchParams(location.search);
  const currentFolderId = params.get("folder");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- REST Queries (Tanstack) ---
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    enabled: !!currentUser,
  });

  const { data: allFolders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ['folders', activeProjectId],
    queryFn: () => api.getFolders(activeProjectId!),
    enabled: !!currentUser && !!activeProjectId,
  });

  const { data: allDocuments = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['documents', activeProjectId],
    queryFn: () => api.getDocuments(activeProjectId!),
    enabled: !!currentUser && !!activeProjectId,
  });

  // --- Synced Stores (Identity/Auth only) ---
  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);

  // --- Presence / Awareness ---
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [myClientId, setMyClientId] = useState<string>("unknown");

  useEffect(() => {
    if (!currentUser) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      setIsSwitchingWorkspace(true);
      const token = await currentUser.getIdToken();
      
      // Map 'playground' to a personalized room name
      const targetProjectId = isPlayground(activeProjectId)
        ? getPlaygroundId(currentUser.uid) 
        : activeProjectId;

      // NAVIGATION GUARD: If we have no active project and are trying to see dashboard, redirect

      // NAVIGATION GUARD: If we have no active project and are trying to see dashboard, redirect
      if (!targetProjectId || targetProjectId === 'null' || targetProjectId === 'undefined') {
        console.warn('[Guard] 🚨 Invalid Project ID on Dashboard. Redirecting to projects list.');
        navigate('/projects');
        return;
      }

      const providers = connectProject(targetProjectId, token, businessId || undefined);

      // Proactive check: if already synced, release immediately
      if (providers.workspaceProvider.synced) {
        setIsSwitchingWorkspace(false);
      }

      // We still sync folders/docs via Hocuspocus, but projects are REST now
      const onSynced = () => {
        console.log('[Dashboard] 🏁 Sync Complete. Releasing overlay.');
        setIsSwitchingWorkspace(false);
      };
      providers.workspaceProvider.on('synced', onSynced);

      // FAILSAFE: Force release after 5 seconds to prevent permanent lockout
      const failsafe = setTimeout(() => {
        setIsSwitchingWorkspace(false);
      }, 5000);

      const updatePresence = () => {
        const states = providers.authProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        const activeProj = projectsQuery.find((p: any) => p.id === targetProjectId);

        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            const email = state.user.email;
            // Lookup role from the project members list
            const member = (activeProj?.members || []).find((m: any) => 
               (typeof m === 'string' ? m : m.email) === email
            );
            const role = member ? (typeof member === 'object' ? member.role : 'editor') : (state.user.id === activeProj?.ownerId ? 'owner' : 'editor');

            clients.push({ 
              id: clientId.toString(), 
              user: state.user,
              role: role
            });
          }
        });
        setConnectedClients(clients);
      };

      providers.authProvider.awareness?.on('change', updatePresence);
      setMyClientId(providers.authProvider.awareness?.clientID.toString() || "unknown");
      providers.authProvider.awareness?.setLocalStateField('user', { 
        name: currentUser.displayName || "Anonymous",
        email: currentUser.email || "guest@system.com",
        photo: currentUser.photoURL,
        id: currentUser.uid,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });

      setIsWorkspaceReady(true);
      cleanup = () => {
        providers.authProvider.awareness?.off('change', updatePresence);
        providers.workspaceProvider.off('synced', onSynced);
        clearTimeout(failsafe);
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId, activeProjectId]);

  // --- Auto-Kick Security Logic ---
  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  // --- Derived State ---
  const folders = workspaceAction.folders || [];
  const documents = workspaceAction.documents || [];
  const projectsQuery = projects; // Renamed to avoid confusion if needed

  // Owners always count as project members — inherit full visibility.
  const userEmail = currentUser?.email || "";

  const normalizeMembers = (list: any): DocumentMember[] => {
    return (list || []).map((m: any) => typeof m === 'string' ? { email: m, role: 'editor' } : m);
  };

  const projectContext = useMemo(() => {
    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return { isMember: false, role: 'viewer' as MemberRole };
    
    if (activeProject.ownerId && activeProject.ownerId === currentUser?.uid) return { isMember: true, role: 'editor' as MemberRole };
    if (activeProject.isOwner) return { isMember: true, role: 'editor' as MemberRole };
    
    const projectMembers = normalizeMembers(activeProject.members);
    const m = projectMembers.find(pm => pm.email === userEmail);
    return { isMember: !!m, role: (m?.role || 'viewer') as MemberRole };
  }, [projects, activeProjectId, userEmail, currentUser]);

  const isProjectMember = projectContext.isMember;
  const canEditProject = projectContext.role === 'editor';

  // Filter items by project AND current folder.
  const folderItems = useMemo(() => {
    return allFolders.filter(f =>
      f.projectId === activeProjectId &&
      (f.parentId === currentFolderId || (f.metadata as any)?.parentId === currentFolderId) &&
      (isProjectMember || normalizeMembers(f.members).some(m => m.email === userEmail))
    );
  }, [allFolders, activeProjectId, currentFolderId, isProjectMember, userEmail]);

  const docItems = useMemo(() => {
    return allDocuments.filter(d =>
      d.projectId === activeProjectId &&
      (d.folderId === currentFolderId) &&
      // HIDE RECEIPTS LINKED TO INVOICES: Keep dashboard clean as per user requirement
      !((d as any).metadata?.isReceipt && (d as any).metadata?.invoiceId) &&
      (isProjectMember || normalizeMembers(d.members).some(m => m.email === userEmail))
    );
  }, [allDocuments, activeProjectId, currentFolderId, isProjectMember, userEmail]);
  
  const currentFolder = useMemo(() => {
    return currentFolderId ? allFolders.find(f => f.id === currentFolderId) : null;
  }, [allFolders, currentFolderId]);

  const getFolderPath = (id: string | null): FolderType[] => {
    if (!id) return [];
    const path: FolderType[] = [];
    let curr = id;
    const email = currentUser?.email || "";
    while (curr) {
      const folder = allFolders.find(f => f.id === curr);
      if (folder && (isProjectMember || (folder.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === userEmail))) {
        path.unshift(folder as any);
        curr = folder.parentId || (folder.metadata as any)?.parentId || "";
      } else curr = "";
    }
    return path;
  };
  const folderPath = getFolderPath(currentFolderId);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return allDocuments.filter(d =>
      d.projectId === activeProjectId &&
      (isProjectMember || (d.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === userEmail)) && (
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content?.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [allDocuments, isSearching, activeProjectId, isProjectMember, userEmail, searchQuery]);

  const searchInvoices = searchResults.filter(d => !d.content?.isReceipt);
  const searchReceipts = searchResults.filter(d => d.content?.isReceipt);

  const items = [
    ...folderItems.map(f => {
      const subFolders = allFolders.filter(sf => sf.parentId === f.id).length;
      const subDocs = allDocuments.filter(sd => sd.folderId === f.id).length;
      return { 
        ...f, 
        id: `f-${f.id}`, 
        _type: 'folder' as const, 
        _realId: f.id,
        stats: { folders: subFolders, files: subDocs }
      };
    }),
    ...docItems.map(d => ({ ...d, id: `d-${d.id}`, _type: 'document' as const, _realId: d.id }))
  ];

  const isLoading = false;

  // --- Actions ---
  const handleCreateFolder = async () => {
    const name = prompt("Folder Name:");
    if (!name || !currentUser?.email || !activeProjectId) return;
    await api.createFolder(name, activeProjectId, currentUser.email, currentFolderId);
    queryClient.invalidateQueries({ queryKey: ['folders', activeProjectId] });
  };

  const handleCreateDocument = async (template?: TemplateDefinition) => {
    setCreateModal({ open: true, template });
  };

  const handleModalSubmit = async (formData: CreateInvoiceFormData) => {
    if (!currentUser?.email) return;
    setIsCreatingDoc(true);
    const isReceipt = createModal.template?.content?.isReceipt;
    const invoiceCode = isReceipt ? undefined : api.getNextInvoiceNumber();
    const name = formData.projectName.trim() || (invoiceCode?.text ?? "New Invoice");
    
    const content: any = {
      contact: {
        name: formData.clientName || "Client Name",
        address1: formData.street || "",
        address2: formData.location || "",
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      },
      title: formData.description || name,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      table: createModal.template?.content?.table || {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description", type: "text" },
          { id: "C", label: "Qty", type: "number", width: "80px" },
          { id: "D", label: "Price (₦)", type: "number", width: "140px" },
          { id: "E", label: "Total (₦)", type: "formula", formula: "C * D", width: "140px" }
        ],
        rows: [{ id: crypto.randomUUID(), rowType: "row", B: "Item", C: 1, D: 0 }],
        summary: [{ id: "subTotal", label: "Sub Total", type: "formula", formula: "sum(E)" }]
      },
      footer: createModal.template?.content?.footer || { notes: "", emphasis: [] },
      invoiceCode,
      isReceipt,
      _templateName: createModal.template?.name,
      _templateColor: createModal.template?.color
    };

    try {
      let newDoc;
      // All new documents — whether from a template or blank — go through the
      // invoices table so they appear in the invoice management flow.
      newDoc = await api.createInvoice(name, content, activeProjectId!, currentUser.uid);

      if (!newDoc?.id) {
        throw new Error('Server returned no document ID. Please try again.');
      }

      setCreateModal({ open: false });
      navigate(isReceipt ? `/receipt-editor/${newDoc.id}` : `/editor/${newDoc.id}`);
    } catch (err: any) {
      console.error('[Dashboard] Failed to create invoice:', err);
      alert(err.message || 'Failed to create invoice. Please try again.');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    const type = item._type as 'folder' | 'document';
    const id = item._realId;
    
    if (type === 'folder') {
      await api.deleteFolder(activeProjectId!, id);
      queryClient.invalidateQueries({ queryKey: ['folders', activeProjectId] });
    } else {
      await api.deleteDocument(activeProjectId!, id);
      queryClient.invalidateQueries({ queryKey: ['documents', activeProjectId] });
    }
  };

  const handleDuplicate = (item: any) => {
    if (!currentUser?.email) return;
    if (item._type === 'folder') api.duplicateFolderToFolder(item._realId, currentFolderId, currentUser.email);
    else api.duplicateDocumentToFolder(item._realId, currentFolderId, currentUser.email);
  };

  const handleRename = (item: any) => {
    setRenamingItem(item);
    setNewName(item.name);
    setIsRenaming(true);
  };

  const confirmRename = () => {
    if (!renamingItem || !newName.trim() || newName === renamingItem.name) {
      setIsRenaming(false);
      return;
    }
    if (renamingItem._type === 'folder') api.renameFolder(renamingItem._realId, newName);
    else api.renameDocument(renamingItem._realId, newName);
    setIsRenaming(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }
    const activeItem = items.find(i => i.id === active.id);
    const overItem = items.find(i => i.id === over.id);
    if (!activeItem || !overItem) { setActiveId(null); return; }

    if (overItem._type === 'folder' && activeItem._type === 'document') {
       api.moveDocument(activeItem._realId, overItem._realId);
    } else {
       api.reorderItems(currentFolderId, active.id as string, over.id as string);
    }
    setActiveId(null);
  };

  return (
    <>
      <AnimatePresence>
        {isSwitchingWorkspace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-md flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-primary/20 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="text-primary animate-spin" size={32} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-black uppercase tracking-widest text-foreground">Switching Workspace</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Synchronizing secure data...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Secondary Navigation (Document Context) */}
        <div className="bg-background/20 backdrop-blur-md border-b border-border/50 sticky top-0 z-10">
          <div className="max-w-[1600px] mx-auto px-8 h-16 flex items-center justify-between">
            <div className="flex flex-col gap-1">
               {/* <h2 className="text-sm font-black text-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                 <Folder size={16} className="text-primary/70 shrink-0" />
                 {currentFolder ? currentFolder.name : "Library"}
               </h2> */}
               <div className="flex items-center gap-1 text-[14px] font-bold tracking-widest uppercase text-muted-foreground/60">
                 <button onClick={() => navigate('/dashboard')} className="hover:text-primary bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                  <Folder size={13} className="text-primary/70 shrink-0" />
                  Home</button>
                 {folderPath.map((folder, idx) => (
                   <React.Fragment key={folder.id}>
                     <span className="opacity-30">/</span>
                     <button 
                       onClick={() => navigate(`/dashboard?folder=${folder.id}`)}
                       className={cn("hover:text-primary transition-colors bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1", idx === folderPath.length - 1 && "text-primary/80 pointer-events-none bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1")}
                     >
                       <Folder size={13} className="text-primary/70 shrink-0" />
                       {folder.name}
                     </button>
                   </React.Fragment>
                 ))}
               </div>
            </div>

            <div className="flex items-center gap-4">
              {canEditProject ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleCreateFolder} className="px-4 py-2 border border-border bg-card text-[10px] font-bold tracking-widest text-foreground rounded-xl hover:bg-muted/50 flex items-center gap-2 transition-all"><Plus size={14} /> FOLDER</button>
                  <button onClick={() => setIsTemplatePickerOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-primary/80 text-primary-foreground rounded-xl hover:opacity-90 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"><Plus size={14} className="mr-1 text-primary-foreground"/> NEW DOC</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-xl border border-border/50 text-muted-foreground">
                  <Eye size={14} className="opacity-60" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Read Only View</span>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Browser Area */}
      <section 
        className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin"
        onClick={() => setSelectedId(null)}
      >
        {activeView === "templates" && (
          <div className="mb-12">
             <div className="flex flex-col gap-2 mb-8">
               <h2 className="text-xl font-bold text-foreground">Template Library</h2>
               <p className="text-xs text-muted-foreground">Select a template to serve as the structure for your new document.</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
               {TEMPLATES.map((template: TemplateDefinition) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template} 
                    onClick={() => handleCreateDocument(template)}
                    onEdit={() => setEditingTemplate(template)}
                    onDelete={() => api.deleteTemplate(template.id)}
                    onPin={() => api.togglePinTemplate(template.id)}
                  />
                ))}
             </div>
          </div>
        )}

        {isSearching && (
          <div className="mb-8">
            {searchResults.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">No results for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchInvoices.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { uiAction.settings.searchQuery = ""; navigate(`/invoice/${doc.id}`); }}
                    className="w-full text-left flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/40 transition-all group"
                  >
                    <div className="p-2 bg-primary/5 rounded-md border border-primary/10 transition-colors group-hover:bg-primary/10">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{doc.content?.contact?.name} • {doc.content?.date}</p>
                    </div>
                    <ArrowLeft size={13} className="text-muted-foreground group-hover:text-primary rotate-180 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}



        {!isSearching && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
              <div className={cn("gap-6", viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "flex flex-col gap-2")}>
                <AnimatePresence>
                  {items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                    <SortableItem 
                      key={item.id} 
                      item={item} 
                      mode={viewMode} 
                      onRename={() => handleRename(item)}
                      onDuplicate={() => handleDuplicate(item)}
                      onDelete={() => handleDelete(item)}
                      onCopy={() => setClipboard({ id: item._realId, name: item.name, type: item._type })}
                      isSelected={selectedId === item.id}
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => {
                        if (item._type === 'folder') {
                          navigate(`/dashboard?folder=${item._realId}`, { state: { fromFolder: currentFolderId } });
                        } else if (item.content?._isResource) {
                          setViewingFile({
                            id: item._realId,
                            name: item.name,
                            url: item.content.url,
                            type: item.content.resourceType,
                            createdAt: item.createdAt || new Date().toISOString(),
                            annotations: item.content.annotations || [],
                            ownerName: item.content.ownerName,
                            ownerPhoto: item.content.ownerPhoto
                          });
                          setViewingFileDocId(item._realId);
                        } else {
                          navigate(item.content?.isReceipt ? `/receipt-editor/${item._realId}` : `/invoice/${item._realId}`, { state: { fromFolder: currentFolderId } });
                        }
                      }}
                      onManageMembers={() => {
                        setMemberModal({
                          open: true,
                          type: item._type,
                          id: item._realId,
                          name: item.name,
                          members: item.members || [],
                          isOwner: (item as any).isOwner || canEditProject
                        });
                      }}
                      currentUserEmail={currentUser?.email || ""}
                      canEdit={canEditProject || (item as any).isOwner}
                    />
                  ))}
                </AnimatePresence>
                {!isSearching && items.length === 0 && (
                   <div className="col-span-full py-20 text-center text-muted-foreground/30 flex flex-col items-center gap-4">
                      <Folder size={64} strokeWidth={1} />
                      <p className="text-xs font-black uppercase tracking-widest">This folder is empty</p>
                   </div>
                )}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? <ItemCard item={items.find(i => i.id === activeId)} mode={viewMode} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      {/* Modals & Overlays */}
      {createModal.open && (
        <CreateInvoiceModal 
          template={createModal.template} 
          onClose={() => setCreateModal({ open: false })} 
          onSubmit={handleModalSubmit}
          isLoading={isCreatingDoc}
        />
      )}

      <TemplatePickerModal
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={(template) => { 
          setIsTemplatePickerOpen(false); 
          handleCreateDocument(template); 
        }}
        onFileUpload={async (file) => {
          if (!currentUser?.email) return;
          const name = file.name;
          const content = {
            _isResource: true,
            resourceType: file.type,
            url: file.url,
            size: file.size,
            name: file.name,
            ownerName: currentUser.displayName,
            ownerPhoto: currentUser.photoURL,
          };
          await api.createDocument(name, content, activeProjectId!, currentUser.email, currentFolderId);
          setIsTemplatePickerOpen(false);
        }}
      />

      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen || !!uiAction.settings.isStreamOpen}
        onClose={() => {
          setIsCollaboratorsOpen(false);
          uiAction.settings.isStreamOpen = false;
        }}
        collaborators={connectedClients}
        ownerId={businessOwnerId || authAction.governance.ownerId || null}
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
          if (!activeProjectId) return;
          try {
            await api.updateMemberRole('project', activeProjectId, email, role);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          } catch (e: any) {
            alert(e.message || "Failed to update role");
          }
        }}
        onAddMember={async (email) => {
          if (!activeProjectId) return;
          await api.addProjectMember(activeProjectId, email, 'viewer');
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      {isProjectModalOpen && (
        <CreateProjectModal 
          isOpen={isProjectModalOpen} 
          onClose={() => setIsProjectModalOpen(false)} 
          onSubmit={async (name) => {
            if (!currentUser?.email) return;
            const newProj = await api.createProject(name, currentUser.email);
            setProject(newProj.id);
            window.location.reload();
          }}
        />
      )}

      {memberModal?.open && (
        <MemberManagementModal
          isOpen={memberModal.open}
          onClose={() => setMemberModal(null)}
          type={memberModal.type}
          id={memberModal.id}
          name={memberModal.name}
          members={memberModal.members}
          isOwner={memberModal.isOwner}
          projectMembers={projects.find(p => p.id === activeProjectId)?.members || []}
          onMembersChanged={(updated) => {
            // Keep modal state in sync and refresh the underlying list
            setMemberModal(m => m ? { ...m, members: updated } : m);
            if (memberModal.type === 'folder') {
              queryClient.invalidateQueries({ queryKey: ['folders', activeProjectId] });
            } else if (memberModal.type === 'document') {
              queryClient.invalidateQueries({ queryKey: ['documents', activeProjectId] });
            } else if (memberModal.type === 'project') {
              queryClient.invalidateQueries({ queryKey: ['projects'] });
            }
          }}
        />
      )}

      <AnimatePresence>
        {isRenaming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
                <h3 className="text-sm font-bold mb-4">Rename Item</h3>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmRename()} className="w-full h-11 px-4 bg-muted border border-border rounded-xl focus:ring-1 ring-primary outline-none text-xs font-semibold mb-6" />
                <div className="flex gap-2">
                   <button onClick={() => setIsRenaming(false)} className="flex-1 h-10 text-[10px] font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all">CANCEL</button>
                   <button onClick={confirmRename} className="flex-1 h-10 bg-primary text-white text-[10px] font-black rounded-xl hover:opacity-90 transition-all">RENAME</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {editingTemplate && <EditTemplateModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={(updated) => api.updateTemplate(updated.id, updated)} />}

      {viewingFile && (
        <FileViewerModal
          file={viewingFile}
          onClose={() => { setViewingFile(null); setViewingFileDocId(null); }}
          onSaveAnnotations={async (_fileId, annotations) => {
            if (!viewingFileDocId) return;
            // Prefer REST cache (source of truth) then fall back to Yjs store
            const docItem =
              allDocuments.find((d: any) => d.id === viewingFileDocId) ||
              workspaceAction.documents.find(d => d.id === viewingFileDocId);
            if (!docItem) return;
            const nextContent = { ...(docItem.content || {}), annotations };
            await api.updateDocument(viewingFileDocId, nextContent);
            // Refresh react-query cache so reopening the file shows the latest annotations
            queryClient.invalidateQueries({ queryKey: ['documents', activeProjectId] });
            // Reflect immediately in the currently open viewer so the user sees
            // their saved pins without closing and reopening
            setViewingFile(prev => prev ? { ...prev, annotations } : prev);
          }}
          role={projectContext.role}
        />
      )}
    </div>
  </>
);
};

const SortableItem = (props: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  return (
    <motion.div ref={setNodeRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }} {...attributes} {...listeners}>
      <ItemCard {...props} />
    </motion.div>
  );
};

const templateBadgeClass = (color?: string) => {
  switch (color) {
    case "blue":   return "bg-t-blue text-t-blue-foreground";
    case "green":  return "bg-t-green text-t-green-foreground";
    case "purple": return "bg-t-purple text-t-purple-foreground";
    case "amber":  return "bg-t-amber text-t-amber-foreground";
    case "rose":   return "bg-t-rose text-t-rose-foreground";
    case "cyan":   return "bg-t-cyan text-t-cyan-foreground";
    case "indigo": return "bg-t-indigo text-t-indigo-foreground";
    case "slate":  return "bg-t-slate text-t-slate-foreground";
    default:       return "bg-muted text-muted-foreground";
  }
};

const ItemCard = ({ item, mode, onClick, onDoubleClick, onDelete, onDuplicate, onRename, onCopy, onManageMembers, isSelected, currentUserEmail, canEdit }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const isFolder = item._type === 'folder';
  const folderStats = isFolder && item.stats ? `${item.stats.folders} ${item.stats.folders === 1 ? 'Folder' : 'Folders'} • ${item.stats.files} ${item.stats.files === 1 ? 'File' : 'Files'}` : null;
  const menuRef = useRef<HTMLDivElement>(null);
  const isLocked = false; 

  const subtitle = isFolder ? (folderStats || "Folder") : (item.content?._type === 'resource' || item.content?._isResource) ? `${item.content.resourceType?.toUpperCase() || 'FILE'} Resource` : (item.content?.title ? (item.content.title.length > 26 ? item.content.title.slice(0, 24) + "…" : item.content.title) : "Invoice");
  const isResource = item.content?._isResource;
  const resourceType = item.content?.resourceType;
  const badgeLabel: string | undefined = !isFolder && !isResource ? (item.content?._templateName as string | undefined) : undefined;
  const badgeClass = templateBadgeClass(item.content?._templateColor);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (mode === "list") {
    return (
      <div onClick={(e) => { e.stopPropagation(); onClick(); }} onDoubleClick={onDoubleClick} className={cn("flex items-center justify-between p-3 rounded-lg cursor-pointer group transition-all", isSelected ? "bg-primary/5 ring-1 ring-primary shadow-sm" : "bg-card hover:bg-muted/50 shadow-sm hover:shadow-md")}>
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-md flex items-center justify-center relative", isFolder ? "bg-amber-500/10 text-amber-600" : isResource ? "bg-slate-100 text-slate-600" : "bg-primary/10 text-primary")}>
            {isFolder ? <Folder size={18} /> : 
              isResource ? (
                resourceType === 'image' ? <ImageIcon size={18} /> :
                resourceType === 'video' ? <Video size={18} /> :
                <FileText size={18} />
              ) : <FileText size={18} />
            }
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold tracking-tight">{item.name}</p>
              {badgeLabel && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none", badgeClass)}>{badgeLabel}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-muted-foreground font-medium">{subtitle} • {new Date(item.updatedAt).toLocaleDateString()}</p>
              {item.content?.ownerName && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-border/50 bg-muted shrink-0">
                      {item.content.ownerPhoto ? (
                        <img src={item.content.ownerPhoto} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <UserIcon size={8} className="text-muted-foreground/60" />
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/80 truncate max-w-[80px]">{item.content.ownerName}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button 
             onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
             className="p-2 text-slate-800 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted rounded-full transition-all border border-transparent hover:border-border/50 active:scale-95 shadow-sm sm:shadow-none"
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} onManageMembers={onManageMembers} isFolder={isFolder} canEdit={canEdit} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 group relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }} onDoubleClick={onDoubleClick}>
           <div className={cn("aspect-[3/4] rounded-lg bg-card shadow-sm transition-all relative border border-border/70 overflow-hidden flex flex-col items-center justify-center", isSelected ? "ring-2 ring-primary/40 shadow-xl scale-[1.03]" : "hover:shadow-lg", isFolder ? "bg-muted/60 border border-border/70 hover:bg-muted/70 shadow-none hover:shadow-md" : "")}>
        {isFolder ? (
          <div className="flex flex-col items-center gap-2">
             <div className="p-4 bg-amber-500/10 rounded-md transition-transform duration-500 hover:scale-110"><Folder size={40} strokeWidth={1.5} className="text-amber-500/80" /></div>
             <span className="text-[9px] font-bold uppercase text-amber-600/60 tracking-widest">Folder</span>
          </div>
        ) : isResource ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
             <div className="w-full h-full relative group/resource overflow-hidden rounded-md">
                {resourceType === 'image' ? (
                  <div className="relative w-full h-full group/image overflow-hidden">
                    <img 
                      src={item.content.url} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover/image:bg-black/40 flex flex-col items-center justify-center transition-all duration-300">
                      <ImageIcon size={32} strokeWidth={1.5} className="text-white mb-2 opacity-80 group-hover/image:opacity-100 transition-opacity" />
                      <span className="text-[9px] font-black uppercase text-white tracking-[0.2em] shadow-sm">IMAGE FILE</span>
                    </div>
                  </div>
                ) : resourceType === 'video' ? (
                  <div className="relative w-full h-full group/video overflow-hidden bg-slate-900">
                    <video 
                      src={item.content.url} 
                      className="w-full h-full object-cover opacity-60 transition-transform duration-500 group-hover/video:scale-110" 
                      muted 
                      playsInline 
                      preload="metadata"
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-300">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-full mb-3 group-hover/video:scale-110 transition-transform">
                        <Video size={24} strokeWidth={1.5} className="text-white" />
                      </div>
                      <span className="text-[9px] font-black uppercase text-white tracking-[0.2em] shadow-sm opacity-80">VIDEO PREVIEW</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full group/pdf overflow-hidden bg-slate-50 dark:bg-muted/20 flex flex-col p-4 border border-border/50">
                    <div className="w-full h-4 bg-slate-200 dark:bg-muted mb-4 rounded-sm px-2 flex items-center justify-between">
                       <div className="w-8 h-1.5 bg-slate-300 dark:bg-muted-foreground/30 rounded-full" />
                       <div className="w-4 h-1.5 bg-slate-300 dark:bg-muted-foreground/30 rounded-full" />
                    </div>
                    <div className="flex-1 space-y-3 opacity-40">
                      <div className="h-2 bg-slate-200 dark:bg-muted rounded-full w-3/4" />
                      <div className="h-2 bg-slate-100 dark:bg-muted rounded-full" />
                      <div className="h-2 bg-slate-100 dark:bg-muted rounded-full w-5/6" />
                    </div>
                    <div className="absolute inset-0 bg-primary/5 dark:bg-primary/5 group-hover/pdf:bg-primary/10 flex flex-col items-center justify-center transition-all">
                       <FileText size={40} strokeWidth={1.2} className="text-primary/40 dark:text-primary/30 mb-2 group-hover/pdf:scale-110 transition-transform" />
                       <span className="text-[9px] font-black uppercase text-primary/60 dark:text-primary/40 tracking-[0.2em]">PDF DOCUMENT</span>
                    </div>
                  </div>
                )}
             </div>
          </div>
        ) : (
          <div className={cn("w-full h-full rounded-md overflow-hidden relative bg-white")}>
             <CardDocumentPreview data={item.content} />
          </div>
        )}
        {badgeLabel && <div className="absolute bottom-3 left-3 pointer-events-none"><span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm leading-none shadow-sm", badgeClass)}>{badgeLabel}</span></div>}
         <div className="absolute top-3 right-3" ref={menuRef}>
           <button 
             onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
             className={cn(
               "p-2 bg-white/90 dark:bg-card/90 backdrop-blur-md shadow-md border border-border/50 rounded-full text-slate-800 dark:text-foreground transition-all duration-200",
               "hover:bg-white dark:hover:bg-card hover:scale-110 active:scale-95 hover:shadow-lg"
             )}
           >
             <MoreHorizontal size={16} />
           </button>
           {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} onManageMembers={onManageMembers} isFolder={isFolder} canEdit={canEdit} />}
         </div>

         {/* Owner Avatar (Grid View) */}
         {item.content?.ownerName && (
           <div className="absolute bottom-2 right-2 flex items-center gap-1.5 p-1 bg-background/60 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-background/80 transition-all">
              <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shadow-sm">
                {item.content.ownerPhoto ? (
                  <img src={item.content.ownerPhoto} className="w-full h-full object-cover" alt={item.content.ownerName} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <UserIcon size={12} className="text-muted-foreground" />
                  </div>
                )}
              </div>
           </div>
         )}
      </div>
      <div className="px-1"><p className="text-[12px] font-semibold truncate tracking-tight text-foreground">{item.name}</p><p className="text-[10px] text-muted-foreground font-medium opacity-70">{subtitle}</p></div>
    </div>
  );
};

const MenuContent = ({ onRename, onDuplicate, onDelete, onCopy, onManageMembers, isFolder, canEdit }: any) => (
  <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in duration-150 origin-top-right">
    <button onClick={(e) => { e.stopPropagation(); onManageMembers(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-primary rounded transition-all"><Users size={14} /> Manage Members</button>
    {canEdit && (
      <>
        <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Edit size={14} /> Rename</button>
        {!isFolder && <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Copy to Clipboard</button>}
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Duplicate</button>
        <div className="my-1 border-t border-border mx-1" />
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold text-destructive hover:bg-destructive/5 rounded transition-all"><Trash size={14} /> Delete</button>
      </>
    )}
  </div>
);

const TemplateCard = ({ template, onClick, onEdit, onDelete, onPin }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-shrink-0 w-48 group text-left relative" ref={menuRef}>
      <button onClick={onClick} className={cn("w-full aspect-[3/4] rounded-lg border border-border p-5 shadow-sm transition-all group-hover:border-primary/40 group-hover:shadow-md flex flex-col justify-between overflow-hidden relative", template.color && templateBadgeClass(template.color))}>
        <div className="p-2.5 bg-primary/5 rounded-md w-fit text-primary group-hover:bg-primary group-hover:text-white transition-all transform group-hover:scale-110"><FileText size={20} /></div>
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">{template.name}{template.isPinned && <Pin size={10} className="text-primary fill-primary" />}</h3>
          <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2 opacity-80">{template.description}</p>
        </div>
      </button>
      <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="absolute top-3 right-3 p-1.5 bg-card shadow-sm border border-border rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-muted"><MoreHorizontal size={14} /></button>
      {showMenu && (
        <div className="absolute right-0 top-12 w-40 bg-popover border border-border shadow-xl rounded-xl p-1 z-[60] origin-top-right animate-in fade-in zoom-in duration-150">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 rounded-lg transition-all"><Edit size={12} /> Edit Data</button>
          <button onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }} className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 rounded-lg transition-all">{template.isPinned ? <PinOff size={12} /> : <Pin size={12} />} {template.isPinned ? 'Unpin' : 'Pin Template'}</button>
          <div className="my-1 border-t border-slate-100 mx-1" />
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this template?')) onDelete(); setShowMenu(false); }} className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash size={12} /> Delete</button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
