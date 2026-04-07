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
  ScrollText
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { type WorkspaceFolder as FolderType, type WorkspaceDocument as DocumentType } from "../store";
import { type TemplateDefinition, TEMPLATES } from "../lib/templates";
import { type InvoiceCode } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentThumbnail } from "./Thumbnail";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, connectWorkspace, workspaceProvider, authProvider } from "../store";
import { useQueryClient } from "@tanstack/react-query";
import { EditTemplateModal } from "./EditTemplateModal";
import CreateInvoiceModal, { type CreateInvoiceFormData } from "./CreateInvoiceModal";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CollaboratorsSheet } from "./CollaboratorsSheet";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { CreateProjectModal } from "./CreateProjectModal";
import { TemplatePickerModal } from "./TemplatePickerModal";
import { MemberManagementModal } from "./MemberManagementModal";
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDefinition | null>(null);
  const [createModal, setCreateModal] = useState<{ open: boolean; template?: TemplateDefinition }>({ open: false });
  const [clipboard, setClipboard] = useState<{ id: string, name: string, type: 'document' | 'folder' } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [activeCollaboratorTab, setActiveCollaboratorTab] = useState<'live' | 'team'>('live');
  const [memberModal, setMemberModal] = useState<{ open: boolean; type: 'project' | 'folder' | 'document'; id: string; name: string; members: string[] } | null>(null);
  
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem("invsys_active_project") || "playground";
  });
  const [activeModule, setActiveModule] = useState<"documents" | "inventory" | "accounting">("documents");
  const [activeView, setActiveView] = useState<"home" | "templates">("home");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  
  const { user: currentUser, logout, businessId, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isMockMode = window.location.hostname === 'localhost' || !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY";

  const [businessName, setBusinessName] = useState("Your Business");
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinessInfo = async () => {
        if (!businessId || isMockMode) {
            setBusinessName("Development Workspace");
            return;
        }
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("../lib/firebase");
        const bDoc = await getDoc(doc(db, "businesses", businessId));
        if (bDoc.exists()) {
            setBusinessName(bDoc.data().name);
            setBusinessOwnerId(bDoc.data().ownerId);
        }
    };
    fetchBusinessInfo();
  }, [businessId, isMockMode]);

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

  // --- Synced Stores ---
  const workspaceAction = useSyncedStore(workspaceStore);
  const authAction = useSyncedStore(authStore);

  // --- Presence / Awareness ---
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [myClientId, setMyClientId] = useState<string>("unknown");

  useEffect(() => {
    if (!currentUser || !businessId) return;

    let cleanup: (() => void) | undefined;

    const startSync = async () => {
      const token = await currentUser.getIdToken();
      const providers = connectWorkspace(businessId, token);
      
      const updatePresence = () => {
        const states = providers.authProvider.awareness?.getStates();
        if (!states) return;
        const clients: any[] = [];
        states.forEach((state: any, clientId: number) => {
          if (state.user && state.user.email) {
            clients.push({ id: clientId.toString(), user: state.user });
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
      };
    };

    startSync();
    return () => cleanup?.();
  }, [currentUser, businessId]);

  // --- Auto-Kick Security Logic ---
  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  // --- Derived State ---
  const folders = workspaceAction.folders || [];
  const documents = workspaceAction.documents || [];
  const projects = (workspaceAction.projects || []) as any[];

  // Filter items by project AND current folder AND membership
  const folderItems = folders.filter(f => 
    f.projectId === activeProjectId && 
    f.parentId === currentFolderId &&
    (isMockMode || (f.members || []).includes(currentUser?.email || ""))
  );
  
  const docItems = documents.filter(d => 
    d.projectId === activeProjectId && 
    d.folderId === currentFolderId
  );
  
  const currentFolder = currentFolderId 
    ? workspaceAction.folders.find(f => f.id === currentFolderId)
    : null;

  const getFolderPath = (id: string | null): FolderType[] => {
    if (!id) return [];
    const allFolders = workspaceAction.folders;
    const path: FolderType[] = [];
    let curr = id;
    const email = currentUser?.email || "";
    while (curr) {
      const folder = allFolders.find(f => f.id === curr);
      if (folder && (isMockMode || (folder.members || []).includes(email))) {
        path.unshift(folder as FolderType);
        curr = folder.parentId || "";
      } else curr = "";
    }
    return path;
  };
  const folderPath = getFolderPath(currentFolderId);

  const docById = useMemo(() => {
    const map = new Map<string, DocumentType>();
    documents.forEach(d => map.set(d.id, d));
    return map;
  }, [documents]);

  const templates = TEMPLATES; 
  const isLoadingTemplates = false;

  const isSearching = searchQuery.trim().length >= 2;

  const searchResults = isSearching 
    ? workspaceAction.documents.filter(d => 
        d.projectId === activeProjectId && 
        (isMockMode || (d.members || []).includes(currentUser?.email || "")) && (
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          d.content?.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : [];

  const searchInvoices = searchResults.filter(d => !d.content?.isReceipt);
  const searchReceipts = searchResults.filter(d => d.content?.isReceipt);

  const items = [
    ...folderItems.map(f => ({ ...f, id: `f-${f.id}`, _type: 'folder' as const, _realId: f.id })),
    ...docItems.map(d => ({ ...d, id: `d-${d.id}`, _type: 'document' as const, _realId: d.id }))
  ];

  const isLoading = false;

  // --- Actions ---
  const handleCreateFolder = async () => {
    const name = prompt("Folder Name:");
    if (!name || !currentUser?.email) return;
    await api.createFolder(name, activeProjectId, currentUser.email, currentFolderId);
  };

  const handleCreateDocument = async (template?: TemplateDefinition) => {
    setCreateModal({ open: true, template });
  };

  const handleModalSubmit = async (formData: CreateInvoiceFormData) => {
    if (!currentUser?.email) return;
    const isReceipt = createModal.template?.content?.isReceipt;
    const invoiceCode = isReceipt ? undefined : api.getNextInvoiceNumber();
    const name = formData.projectName.trim() || (invoiceCode?.text ?? "New Invoice");
    
    // Construct initial content
    const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const content: any = {
      contact: {
        name: formData.clientName || "Client Name",
        address1: formData.street || "",
        address2: formData.location || "",
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      },
      title: formData.description || name,
      date: now,
      table: createModal.template?.content?.table || {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description", type: "text" },
          { id: "C", label: "Qty", type: "number", width: "80px" },
          { id: "D", label: "Price (₦)", type: "number", width: "140px" },
          { id: "E", label: "Total (₦)", type: "formula", formula: "C * D", width: "140px" }
        ],
        rows: [{ id: crypto.randomUUID(), rowType: "row", B: "Item", C: 1, D: 0 }],
        summary: [{ id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }]
      },
      footer: createModal.template?.content?.footer || { notes: "", emphasis: [] },
      invoiceCode,
      isReceipt,
      _templateName: createModal.template?.name,
      _templateColor: createModal.template?.color
    };

    const newDoc = await api.createDocument(name, content, activeProjectId, currentUser.email, currentFolderId);
    setCreateModal({ open: false });
    navigate(isReceipt ? `/receipt-editor/${newDoc.id}` : `/editor/${newDoc.id}`);
  };

  const handleDelete = (item: any) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    if (item._type === 'folder') api.deleteFolder(item._realId);
    else api.deleteDocument(item._realId);
  };

  const handleDuplicate = (item: any) => {
    if (!currentUser?.email) return;
    if (item._type === 'folder') api.duplicateFolderToFolder(item._realId, currentFolderId, currentUser.email);
    else api.duplicateDocumentToFolder(item._realId, currentFolderId, currentUser.email);
  };

  const handleRename = (item: any) => {
    const newName = prompt("New Name:", item.name);
    if (!newName || newName === item.name) return;
    if (item._type === 'folder') api.renameFolder(item._realId, newName);
    else api.renameDocument(item._realId, newName);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }
    
    const activeItem = items.find(i => i.id === active.id);
    const overItem = items.find(i => i.id === over.id);

    if (!activeItem || !overItem) {
      setActiveId(null);
      return;
    }

    if (overItem && overItem._type === 'folder' && activeItem && activeItem._type === 'document') {
       api.moveDocument(activeItem._realId, overItem._realId);
    } else if (overItem && activeItem) {
       api.reorderItems(currentFolderId, active.id as string, over.id as string);
    }
    
    setActiveId(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground transition-all duration-300 font-lexend overflow-hidden">
      {/* Unified Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col p-6 space-y-8">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary rounded-lg shadow-sm">
            <FileText size={20} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-sm font-bold tracking-tight uppercase text-foreground">INV-SYS Pro</h1>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-10">
          {/* Library Section */}
          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50 flex items-center gap-2">
              <Folder size={12} /> Library
            </h3>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<Clock size={18} />} 
                label="Home" 
                active={activeView === "home" && !currentFolderId} 
                onClick={() => { setActiveView("home"); navigate("/dashboard"); }} 
              />
              <SidebarItem 
                icon={<ScrollText size={18} />} 
                label="Templates" 
                active={activeView === "templates"} 
                onClick={() => setActiveView("templates")} 
              />
              <SidebarItem icon={<Users size={18} />} label="Manage Team" onClick={() => {
                  setActiveCollaboratorTab('team');
                  setIsCollaboratorsOpen(true);
              }} />
              <SidebarItem icon={<Trash size={18} />} label="Trash bin" onClick={() => alert("Trash feature coming soon")} />
            </nav>
          </div>

          {/* Modules Section */}
          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50 flex items-center gap-2">
              <Boxes size={12} /> Modules
            </h3>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<FileText size={18} />} 
                label="Documents" 
                active={activeModule === "documents"} 
                onClick={() => setActiveModule("documents")} 
              />
              <SidebarItem 
                icon={<Boxes size={18} />} 
                label="Project Scope" 
                active={false} 
                onClick={() => setIsProjectModalOpen(true)} 
              />
              <SidebarItem 
                icon={<LayoutGrid size={18} />} 
                label="Inventory" 
                active={activeModule === "inventory"} 
                onClick={() => setActiveModule("inventory")} 
              />
              <SidebarItem 
                icon={<Calculator size={18} />} 
                label="Accounting" 
                active={activeModule === "accounting"} 
                onClick={() => setActiveModule("accounting")} 
              />
            </nav>
          </div>
        </div>

        {/* Footer / User */}
        <div className="pt-6 border-t border-border/50">
          <div 
            className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-muted/20 group relative overflow-hidden transition-all hover:bg-muted/40 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
               {currentUser?.photoURL ? (
                 <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
               ) : (
                 <UserIcon className="text-primary" size={16} />
               )}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <p className="text-[11px] font-black truncate text-foreground">{currentUser?.displayName || 'User'}</p>
              <p className="text-[9px] text-muted-foreground truncate uppercase tracking-widest font-bold opacity-60">{role || 'Admin'}</p>
            </div>
            <button 
              onClick={() => logout()}
              className="absolute right-2 p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all text-muted-foreground group-hover:opacity-100"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-8 bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search documents..." 
                className="w-full pl-9 pr-4 py-1.5 bg-muted/30 border border-transparent focus:border-border focus:bg-card rounded-xl outline-none text-xs transition-all" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
            {currentFolderId && (
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 h-8 px-3 flex items-center gap-2 hover:bg-muted rounded-lg transition-all text-xs font-bold text-muted-foreground"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <ProjectSwitcher 
                projects={projects}
                activeProjectId={activeProjectId}
                onSelect={(id) => {
                    setActiveProjectId(id);
                    localStorage.setItem("invsys_active_project", id);
                    navigate("/dashboard");
                }}
                onCreateNew={() => setIsProjectModalOpen(true)}
            />

            <div className="w-px h-8 bg-border opacity-50" />

            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {connectedClients.map((client) => {
                const isMe = client.user?.email === currentUser?.email;
                return (
                  <div 
                    key={client.id}
                    title={client.user?.name}
                    className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white relative group"
                    style={{ backgroundColor: client.user?.color || '#cbd5e1' }}
                  >
                    {client.user?.name?.charAt(0) || '?'}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleTheme}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all relative group"
                >
                  {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                
                <button
                  onClick={() => {
                    setActiveCollaboratorTab('live');
                    setIsCollaboratorsOpen(true);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all relative group"
                >
                  <Users size={18} />
                  {connectedClients.length > 1 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-card" />
                  )}
                </button>
              </div>
          </div>
        </header>

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
                 {templates.map((template: TemplateDefinition) => (
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
                      onClick={() => { setSearchQuery(""); navigate(`/invoice-preview/${doc.id}`); }}
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
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col gap-1.5">
                 <h2 className="text-sm font-black text-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                   <Folder size={18} className="text-primary/70 shrink-0" />
                   {currentFolder ? currentFolder.name : "Library"}
                 </h2>
                 <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60">
                   <button onClick={() => navigate('/dashboard')} className="hover:text-primary transition-colors">Home</button>
                   {folderPath.map((folder, idx) => (
                     <React.Fragment key={folder.id}>
                       <span className="opacity-30">/</span>
                       <button 
                         onClick={() => navigate(`/dashboard?folder=${folder.id}`)}
                         className={cn("hover:text-primary transition-colors", idx === folderPath.length - 1 && "text-primary/80 pointer-events-none")}
                       >
                         {folder.name}
                       </button>
                     </React.Fragment>
                   ))}
                 </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex p-0.5 bg-muted/50 rounded-lg">
                  <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-all", viewMode === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}><LayoutGrid size={14} /></button>
                  <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}><List size={14} /></button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={handleCreateFolder} className="px-4 py-2 border border-border bg-card text-[10px] font-bold tracking-widest text-foreground rounded-xl hover:bg-muted/50 flex items-center gap-2 transition-all"><Plus size={14} /> FOLDER</button>
                  <button onClick={() => setIsTemplatePickerOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"><Plus size={14} /> NEW DOC</button>
                </div>
              </div>
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
                          } else {
                            const isReceipt = item.content?.isReceipt;
                            navigate(isReceipt ? `/receipt-editor/${item._realId}` : `/invoice-preview/${item._realId}`, { state: { fromFolder: currentFolderId } });
                          }
                        }}
                        onManageMembers={() => {
                          setMemberModal({
                            open: true,
                            type: item._type,
                            id: item._realId,
                            name: item.name,
                            members: item.members || []
                          });
                        }}
                        currentUserEmail={currentUser?.email || ""}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId ? <ItemCard item={items.find(i => i.id === activeId)} mode={viewMode} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </section>
      </main>

      {editingTemplate && <EditTemplateModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={(updated) => api.updateTemplate(updated.id, updated)} />}
      
      {createModal.open && <CreateInvoiceModal template={createModal.template} onClose={() => setCreateModal({ open: false })} onSubmit={handleModalSubmit} isLoading={false} />}
      
      <TemplatePickerModal isOpen={isTemplatePickerOpen} onClose={() => setIsTemplatePickerOpen(false)} onSelect={(template) => { setIsTemplatePickerOpen(false); handleCreateDocument(template); }} />

      <CollaboratorsSheet isOpen={isCollaboratorsOpen} onClose={() => setIsCollaboratorsOpen(false)} collaborators={connectedClients} ownerId={businessOwnerId || authAction.governance.ownerId || null} bannedClients={authAction.bannedClients} businessId={businessId} businessName={businessName} initialTab={activeCollaboratorTab} onBanClient={(email) => { if (!authAction.bannedClients.includes(email)) authAction.bannedClients.push(email); }} onMakeOwner={(email) => { authAction.governance.ownerId = email; }} />

      {memberModal?.open && <MemberManagementModal isOpen={memberModal.open} onClose={() => setMemberModal(null)} type={memberModal.type} id={memberModal.id} name={memberModal.name} members={memberModal.members} />}
      
      {isProjectModalOpen && (
        <CreateProjectModal 
          isOpen={isProjectModalOpen} 
          onClose={() => setIsProjectModalOpen(false)} 
          onSubmit={async (name) => {
            if (!currentUser?.email) return;
            const newProj = await api.createProject(name, currentUser.email);
            setActiveProjectId(newProj.id);
            localStorage.setItem("invsys_active_project", newProj.id);
            navigate("/dashboard");
          }}
        />
      )}
    </div>
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

const ItemCard = ({ item, mode, onClick, onDoubleClick, onDelete, onDuplicate, onRename, onCopy, onManageMembers, isSelected, currentUserEmail }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const isFolder = item._type === 'folder';
  const menuRef = useRef<HTMLDivElement>(null);
  const isLocked = false; // Emergency bypass: Always unlocked

  const subtitle = isFolder ? "Folder" : (item.content?.title ? (item.content.title.length > 26 ? item.content.title.slice(0, 24) + "…" : item.content.title) : "Invoice");
  const badgeLabel: string | undefined = !isFolder ? (item.content?._templateName as string | undefined) : undefined;
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
          <div className={cn("p-2 rounded-md flex items-center justify-center relative", isFolder ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary")}>
            {isFolder ? <Folder size={18} /> : <FileText size={18} />}
            {isLocked && <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm"><Shield size={10} className="text-destructive" /></div>}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold tracking-tight">{item.name}</p>
              {badgeLabel && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none", badgeClass)}>{badgeLabel}</span>}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{subtitle} • {new Date(item.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-all border border-transparent hover:border-border"><MoreHorizontal size={16} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} onManageMembers={onManageMembers} isFolder={isFolder} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 group relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }} onDoubleClick={onDoubleClick}>
      <div className={cn("aspect-[3/4] rounded-lg bg-card shadow-sm transition-all relative overflow-hidden flex flex-col items-center justify-center", isSelected ? "ring-2 ring-primary/40 shadow-xl scale-[1.03]" : "hover:shadow-lg", isFolder ? "bg-amber-500/5 shadow-none hover:shadow-md" : "")}>
        {isFolder ? (
          <div className="flex flex-col items-center gap-2">
             <div className="p-4 bg-amber-500/10 rounded-md transition-transform duration-500 hover:scale-110"><Folder size={40} strokeWidth={1.5} className="text-amber-500/80" /></div>
             <span className="text-[9px] font-bold uppercase text-amber-600/60 tracking-widest">Folder</span>
          </div>
        ) : (
          <div className={cn("w-full h-full rounded-md overflow-hidden p-1.5 relative", isLocked && "blur-[1.5px] opacity-40 grayscale")}>
             <DocumentThumbnail data={item.content} className="rounded-sm" />
             {isLocked && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[0.5px]">
                 <div className="p-3 bg-card rounded-full shadow-lg border border-border"><Shield size={20} className="text-destructive" /></div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-destructive mt-3 bg-background/80 px-2 py-0.5 rounded shadow-sm">Restricted</p>
               </div>
             )}
          </div>
        )}
        {badgeLabel && <div className="absolute bottom-3 left-3 pointer-events-none"><span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm leading-none shadow-sm", badgeClass)}>{badgeLabel}</span></div>}
        <div className="absolute top-3 right-3" ref={menuRef}>
          <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1.5 bg-white/90 backdrop-blur shadow-sm border border-border rounded-md hover:bg-white text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"><MoreHorizontal size={14} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} onManageMembers={onManageMembers} isFolder={isFolder} />}
        </div>
      </div>
      <div className="px-1"><p className="text-[12px] font-semibold truncate tracking-tight text-slate-700">{item.name}</p><p className="text-[10px] text-muted-foreground font-medium opacity-70">{subtitle}</p></div>
    </div>
  );
};

const MenuContent = ({ onRename, onDuplicate, onDelete, onCopy, onManageMembers, isFolder }: any) => (
  <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in duration-150 origin-top-right">
    <button onClick={(e) => { e.stopPropagation(); onManageMembers(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-primary rounded transition-all"><Users size={14} /> Manage Members</button>
    <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Edit size={14} /> Rename</button>
    {!isFolder && <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Copy to Clipboard</button>}
    <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Duplicate</button>
    <div className="my-1 border-t border-border mx-1" />
    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold text-destructive hover:bg-destructive/5 rounded transition-all"><Trash size={14} /> Delete</button>
  </div>
);

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={cn("w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative overflow-hidden", active ? "bg-primary/5 text-primary shadow-sm" : "text-slate-400 hover:text-slate-200")}>
    <div className={cn("shrink-0 transition-transform group-hover:scale-110", active && "scale-105")}>{icon}</div>
    <span className={cn("text-xs font-black tracking-tight", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
    {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full" />}
  </button>
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
