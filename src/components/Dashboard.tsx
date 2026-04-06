import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Folder, 
  FileText, 
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
  Type
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { type WorkspaceFolder as FolderType, type WorkspaceDocument as DocumentType } from "../store";
import { type TemplateDefinition, TEMPLATES } from "../lib/templates";
import { type InvoiceCode } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentThumbnail } from "./Thumbnail";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, authStore, authProvider } from "../store";
import { useQueryClient } from "@tanstack/react-query";
import { EditTemplateModal } from "./EditTemplateModal";
import CreateInvoiceModal, { type CreateInvoiceFormData } from "./CreateInvoiceModal";
import { Pin, PinOff, AlertTriangle, Users, LogOut, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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
  const { user: currentUser } = useAuth();

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
  const myClientId = authProvider.awareness?.clientID.toString() || "unknown";

  useEffect(() => {
    if (!currentUser) return;

    const updatePresence = () => {
      const states = authProvider.awareness?.getStates();
      if (!states) return;
      const clients: any[] = [];
      states.forEach((state: any, clientId: number) => {
        // Only track users with an authenticated email address
        if (state.user && state.user.email) {
          clients.push({
            id: clientId.toString(),
            user: state.user
          });
        }
      });
      setConnectedClients(clients);
    };

    authProvider.awareness?.on('change', updatePresence);
    
    // Set identity from Google Auth
    authProvider.awareness?.setLocalStateField('user', { 
      name: currentUser.displayName || "Anonymous",
      email: currentUser.email || "guest@system.com",
      photo: currentUser.photoURL,
      id: currentUser.uid,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    });
    
    return () => {
      authProvider.awareness?.off('change', updatePresence);
    };
  }, [myClientId, currentUser]);

  // --- Auto-Kick Security Logic ---
  useEffect(() => {
    if (currentUser?.email && authAction.bannedClients?.includes(currentUser.email)) {
      navigate("/denied");
    }
  }, [authAction.bannedClients, currentUser, navigate]);

  // --- Derived State ---
  const folders = workspaceAction.folders || [];
  const documents = workspaceAction.documents || [];
  const folderItems = folders.filter(f => f.parentId === currentFolderId);
  const docItems = documents.filter(d => d.folderId === currentFolderId);
  
  const currentFolder = currentFolderId 
    ? workspaceAction.folders.find(f => f.id === currentFolderId)
    : null;

  const getFolderPath = (id: string | null): FolderType[] => {
    if (!id) return [];
    const allFolders = workspaceAction.folders;
    const path: FolderType[] = [];
    let curr = id;
    while (curr) {
      const folder = allFolders.find(f => f.id === curr);
      if (folder) {
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
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.content?.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const searchInvoices = searchResults.filter(d => !d.content?.isReceipt);
  const searchReceipts = searchResults.filter(d => d.content?.isReceipt);

  const items = [
    ...folderItems.map(f => ({ ...f, id: `f-${f.id}`, _type: 'folder' as const, _realId: f.id })),
    ...docItems.map(d => ({ ...d, id: `d-${d.id}`, _type: 'document' as const, _realId: d.id }))
  ];

  const isLoading = false; // Sync is instant now

  // --- Actions ---
  const handleCreateFolder = async () => {
    const name = prompt("Folder Name:");
    if (!name) return;
    await api.createFolder(name, currentFolderId);
  };

  const handleCreateDocument = async (template?: TemplateDefinition) => {
    setCreateModal({ open: true, template });
  };

  const handleModalSubmit = async (formData: CreateInvoiceFormData) => {
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
      _templateName: createModal.template?.name,
      _templateColor: createModal.template?.color
    };

    const newDoc = await api.createDocument(name, content, currentFolderId);
    setCreateModal({ open: false });
    navigate(isReceipt ? `/receipt-editor/${newDoc.id}` : `/editor/${newDoc.id}`);
  };

  const handleDelete = (item: any) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    if (item._type === 'folder') api.deleteFolder(item._realId);
    else api.deleteDocument(item._realId);
  };

  const handleDuplicate = (item: any) => {
    if (item._type === 'folder') api.duplicateFolderToFolder(item._realId, currentFolderId);
    else api.duplicateDocumentToFolder(item._realId, currentFolderId);
  };

  const handleRename = (item: any) => {
    const newName = prompt("New Name:", item.name);
    if (!newName || newName === item.name) return;
    if (item._type === 'folder') api.renameFolder(item._realId, newName);
    else api.updateDocument(item._realId, { name: newName });
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

    if (overItem && overItem._type === 'folder' && activeItem) {
       api.moveDocument(activeItem.id, overItem._realId);
    } else if (overItem && activeItem) {
       api.reorderItems(currentFolderId, active.id as string, over.id as string);
    }
    
    setActiveId(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground transition-all duration-300 font-lexend overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-slate-50/30 hidden md:flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary rounded-lg shadow-sm">
            <FileText size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-sm font-bold tracking-tight uppercase">Shan Docs</h1>
        </div>
        <nav className="flex-1 space-y-0.5">
          <SidebarItem icon={<Clock size={18} />} label="All Files" active onClick={() => navigate("/dashboard")} />
          <SidebarItem icon={<Folder size={18} />} label="Trash" onClick={() => alert("Trash feature coming soon")} />
        </nav>
        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-muted/40 border border-border/50">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><UserIcon className="text-primary" size={14} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">Olamide</p>
              <p className="text-[10px] text-muted-foreground truncate opacity-70">Admin Account</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-6 flex-1">
            {currentFolderId && (
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 h-8 w-8 flex items-center justify-center hover:bg-muted rounded-md transition-all border border-border"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search documents..." 
                className="w-full pl-9 pr-4 py-1.5 bg-muted/30 border border-border focus:border-primary/50 focus:bg-white rounded-md outline-none text-xs transition-all" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Session Owners & Presence */}
            <div className="flex items-center -space-x-1 overflow-hidden mr-2">
              {connectedClients.map((client) => {
                const isOwner = authAction.governance.ownerId === client.id;
                const isMe = client.id === myClientId;
                return (
                  <div 
                    key={client.id}
                    title={`${client.user.name}${isOwner ? ' (Store Owner)' : ''}${isMe ? ' (You)' : ''}`}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white relative group",
                      isOwner ? "bg-amber-500 z-10" : "bg-slate-400"
                    )}
                    style={{ backgroundColor: client.user.color }}
                  >
                    {client.user.name.charAt(0)}
                    {isOwner && <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full border border-white shadow-sm" />}
                    
                    {/* Admin Kick Tooltip */}
                    {authAction.governance.ownerId === myClientId && !isMe && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          authAction.bannedClients.push(client.id);
                        }}
                        className="absolute inset-0 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Trash size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Owner Control */}
            <div className="flex items-center gap-2">
                {authAction.governance.ownerId && (
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border rounded-md transition-all",
                    authAction.governance.ownerId === currentUser?.email 
                      ? "bg-amber-50 border-amber-200 text-amber-700" 
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  )}>
                    <Shield size={14} className={authAction.governance.ownerId === currentUser?.email ? "fill-amber-500" : ""} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {authAction.governance.ownerId === currentUser?.email ? "Owner View" : "Public View"}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setIsCollaboratorsOpen(true)}
                  className="p-3 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all relative group"
                >
                  <Users size={20} />
                  {connectedClients.length > 1 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white" />
                  )}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {connectedClients.length} Online
                  </span>
                </button>
              </div>

            <div className="flex p-0.5 bg-muted/50 rounded-md border border-border">
              <button 
                onClick={() => setViewMode("grid")} 
                className={cn("p-1.5 rounded-sm transition-all", viewMode === "grid" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              ><LayoutGrid size={14} /></button>
              <button 
                onClick={() => setViewMode("list")} 
                className={cn("p-1.5 rounded-sm transition-all", viewMode === "list" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              ><List size={14} /></button>
            </div>
            <button 
              onClick={() => handleCreateDocument()} 
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-bold text-xs transition-all hover:bg-primary/90"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Doc</span>
            </button>
          </div>
        </header>

        {/* Browser Area */}
        <section 
          className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin"
          onClick={() => setSelectedId(null)}
        >

          {!isSearching && !currentFolderId && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-widest opacity-80">Start with a Template</h2>
                  <p className="text-[10px] text-muted-foreground font-medium">Choose a preset structure for your invoice</p>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin">
                {isLoadingTemplates ? (
                  <div className="flex gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <TemplateSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  templates.map((template: TemplateDefinition) => (
                    <TemplateCard 
                      key={template.id} 
                      template={template} 
                      onClick={() => handleCreateDocument(template)}
                      onEdit={() => setEditingTemplate(template)}
                      onDelete={() => api.deleteTemplate(template.id)}
                      onPin={() => api.togglePinTemplate(template.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Deep Search Results ── */}
          {isSearching && (
            <div className="mb-8">
              {searchResults.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Search size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No results for "{searchQuery}"</p>
                  <p className="text-xs opacity-60 mt-1">Try a different name, number, or client</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {searchInvoices.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Invoices</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary">{searchInvoices.length}</span>
                      </div>
                      <div className="space-y-2">
                        {searchInvoices.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => { setSearchQuery(""); navigate(`/invoice-preview/${doc.id}`); }}
                            className="w-full text-left flex items-center gap-4 p-4 bg-white border border-border rounded-lg hover:border-primary/40 hover:shadow-sm transition-all group"
                          >
                            <div className="p-2 bg-primary/5 rounded-md border border-primary/10 shrink-0">
                              <FileText size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {doc.content?.invoiceCode?.text && (
                                  <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded tracking-wider font-lexend">
                                    {doc.content.invoiceCode.text}
                                  </span>
                                )}
                                <span className="text-xs font-semibold text-slate-800 truncate">{doc.name}</span>
                                {doc.content?._templateName && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{doc.content._templateName}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-slate-400">{doc.content?.contact?.name}</span>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className="text-[10px] text-slate-400">{doc.content?.date}</span>
                                {doc.content?.title && doc.content.title !== doc.name && (
                                  <>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-400 italic truncate">{doc.content.title}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowLeft size={13} className="text-slate-300 group-hover:text-primary rotate-180 transition-colors shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchReceipts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Receipts</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-600">{searchReceipts.length}</span>
                      </div>
                      <div className="space-y-2">
                        {searchReceipts.map(doc => {
                          const parentInv = doc.invoiceId ? docById.get(doc.invoiceId) : undefined;
                          return (
                            <button
                              key={doc.id}
                              onClick={() => { setSearchQuery(""); navigate(`/receipt-editor/${doc.id}`); }}
                              className="w-full text-left flex items-center gap-4 p-4 bg-white border border-border rounded-lg hover:border-emerald-400/40 hover:shadow-sm transition-all group"
                            >
                              <div className="p-2 bg-emerald-50 rounded-md border border-emerald-100 shrink-0">
                                <FileText size={16} className="text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {doc.content?.invoiceCode?.text && (
                                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded tracking-wider font-lexend">
                                      {doc.content.invoiceCode.text}
                                    </span>
                                  )}
                                  {parentInv && (
                                    <>
                                      <span className="text-[9px] text-slate-300">linked to</span>
                                      <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded tracking-wider font-lexend">
                                        {parentInv.content?.invoiceCode?.text || parentInv.name}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-slate-400">{doc.content?.contact?.name}</span>
                                  <span className="text-[10px] text-slate-300">•</span>
                                  <span className="text-[10px] text-slate-400">{doc.content?.date}</span>
                                  {doc.content?.amountPaid !== undefined && (
                                    <>
                                      <span className="text-[10px] text-slate-300">•</span>
                                      <span className="text-[10px] font-semibold text-emerald-600">
                                        ₦{Math.round(doc.content.amountPaid).toLocaleString()} paid
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ArrowLeft size={13} className="text-slate-300 group-hover:text-emerald-500 rotate-180 transition-colors shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isSearching && <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1.5">
               <h2 className="text-sm font-black text-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                 <Folder size={18} className="text-primary/70 shrink-0" />
                 {currentFolder ? currentFolder.name : "Library"}
               </h2>
               {clipboard && (
                 <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-primary/5 border border-primary/20 rounded-md w-fit animate-in slide-in-from-left-2 duration-300">
                   <Copy size={10} className="text-primary/60" />
                   <span className="text-[10px] text-primary/80 font-medium">Copied: <span className="font-bold">{clipboard.name}</span></span>
                   <button 
                     onClick={() => setClipboard(null)}
                     className="ml-2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                   >Cancel</button>
                 </div>
               )}
               
               {/* Breadcrumbs */}
               <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60">
                 <button 
                   onClick={() => navigate('/dashboard')}
                   className="hover:text-primary transition-colors"
                 >Home</button>
                 {folderPath.map((folder, idx) => (
                   <React.Fragment key={folder.id}>
                     <span className="opacity-30">/</span>
                     <button 
                       onClick={() => navigate(`/dashboard?folder=${folder.id}`)}
                       className={cn(
                         "hover:text-primary transition-colors",
                         idx === folderPath.length - 1 && "text-primary/80 pointer-events-none"
                       )}
                     >
                       {folder.name}
                     </button>
                   </React.Fragment>
                 ))}
               </div>
            </div>
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1.5 border border-border bg-white text-[10px] font-bold tracking-widest text-foreground rounded-md transition-all hover:bg-muted"
            >+ NEW FOLDER</button>
          </div>}

          {!isSearching && isLoading ? (
            <div className={cn("gap-6", viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "flex flex-col gap-2")}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <ItemSkeleton key={i} mode={viewMode} />
              ))}
            </div>
          ) : !isSearching ? (
            <DndContext
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={(e) => setActiveId(e.active.id as string)}
              onDragEnd={handleDragEnd}
            >
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
                            navigate(
                              isReceipt ? `/receipt-editor/${item._realId}` : `/invoice-preview/${item._realId}`,
                              { state: { fromFolder: currentFolderId } }
                            );
                          }
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
              
              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <div className="opacity-70 scale-102 pointer-events-none">
                    <ItemCard item={items.find(i => i.id === activeId)} mode={viewMode} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : null}
        </section>
      </main>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(updated) => api.updateTemplate(updated.id, updated)}
        />
      )}

      {/* Create Invoice Modal */}
      {createModal.open && (
        <CreateInvoiceModal
          template={createModal.template}
          onClose={() => setCreateModal({ open: false })}
          onSubmit={handleModalSubmit}
          isLoading={false}
        />
      )}

      {/* Collaborators Sheet */}
      <CollaboratorsSheet
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        collaborators={connectedClients}
        ownerId={authAction.governance.ownerId || null}
        bannedClients={authAction.bannedClients}
        onBanClient={(email) => {
          if (!authAction.bannedClients.includes(email)) {
            authAction.bannedClients.push(email);
          }
        }}
        onMakeOwner={(email) => {
          authAction.governance.ownerId = email;
        }}
      />
    </div>
  );
};

const SidebarItem = ({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group", active ? "bg-primary/5 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
    <span className={cn("transition-all duration-300", active ? "text-primary" : "text-muted-foreground group-hover:text-primary")}>{icon}</span>
    <span className="text-xs font-semibold tracking-tight">{label}</span>
  </button>
);

const SortableItem = (props: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  return (
    <motion.div 
      ref={setNodeRef} 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }} 
      {...attributes} 
      {...listeners}
    >
      <ItemCard {...props} />
    </motion.div>
  );
};

// Maps template color names → Tailwind badge classes
const templateBadgeClass = (color?: string) => {
  switch (color) {
    case "blue":   return "bg-blue-100 text-blue-700";
    case "green":  return "bg-green-100 text-green-700";
    case "purple": return "bg-purple-100 text-purple-700";
    case "amber":  return "bg-amber-100 text-amber-700";
    case "rose":   return "bg-rose-100 text-rose-700";
    case "cyan":   return "bg-cyan-100 text-cyan-700";
    case "indigo": return "bg-indigo-100 text-indigo-700";
    case "slate":  return "bg-slate-200 text-slate-600";
    default:       return "bg-slate-100 text-slate-500";
  }
};

const ItemCard = ({ item, mode, onClick, onDoubleClick, onDelete, onDuplicate, onRename, onCopy, isSelected }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const isFolder = item._type === 'folder';
  const menuRef = useRef<HTMLDivElement>(null);

  // Subtitle: truncated content.title (e.g. "Design Fee Invoice") for docs, "Folder" for folders
  const subtitle = isFolder
    ? "Folder"
    : item.content?.title
      ? (item.content.title.length > 26 ? item.content.title.slice(0, 24) + "…" : item.content.title)
      : "Invoice";

  // Template type badge (only for docs that have _templateName)
  const badgeLabel: string | undefined = !isFolder ? (item.content?._templateName as string | undefined) : undefined;
  const badgeClass = templateBadgeClass(item.content?._templateColor);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (mode === "list") {
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); onClick(); }} 
        onDoubleClick={onDoubleClick}
        className={cn(
          "flex items-center justify-between p-3 border rounded-lg cursor-pointer group transition-all",
          isSelected 
            ? "bg-primary/5 border-primary shadow-sm" 
            : "bg-white border-border hover:border-primary/40 hover:bg-slate-50/50"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-md flex items-center justify-center border", isFolder ? "bg-amber-50 text-amber-600 border-amber-200/50" : "bg-primary/5 text-primary border-primary/20")}>
            {isFolder ? <Folder size={18} /> : <FileText size={18} />}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold tracking-tight">{item.name}</p>
              {badgeLabel && (
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none", badgeClass)}>
                  {badgeLabel}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">
              {subtitle} • {new Date(item.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-all border border-transparent hover:border-border"
          ><MoreHorizontal size={16} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} isFolder={isFolder} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 group relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }} onDoubleClick={onDoubleClick}>
      <div
        className={cn(
          "aspect-[3/4] rounded-lg border bg-white shadow-sm transition-all relative overflow-hidden flex flex-col items-center justify-center",
          isSelected ? "border-primary ring-2 ring-primary/20 shadow-md scale-[1.02]" : "border-border hover:border-primary/40 hover:shadow-md",
          isFolder ? "bg-amber-50/5" : ""
        )}
      >
        {isFolder ? (
          <div className="flex flex-col items-center gap-2">
             <div className="p-4 bg-amber-50 border border-amber-100 rounded-md transition-transform duration-500">
               <Folder size={40} strokeWidth={1.5} className="text-amber-500/80" />
             </div>
             <span className="text-[9px] font-bold uppercase text-amber-700/60 tracking-widest">Folder</span>
          </div>
        ) : (
          <div className="w-full h-full rounded-md overflow-hidden p-1.5">
             <DocumentThumbnail data={item.content} className="rounded-sm" />
          </div>
        )}

        {/* Template type badge — bottom-left of thumbnail */}
        {badgeLabel && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm leading-none shadow-sm", badgeClass)}>
              {badgeLabel}
            </span>
          </div>
        )}

        {/* Actions Button */}
        <div className="absolute top-3 right-3" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-white/90 backdrop-blur shadow-sm border border-border rounded-md hover:bg-white text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
          ><MoreHorizontal size={14} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onCopy={onCopy} isFolder={isFolder} />}
        </div>
      </div>
      <div className="px-1" onClick={onClick}>
        <p className="text-[12px] font-semibold truncate tracking-tight text-slate-700">{item.name}</p>
        <p className="text-[10px] text-muted-foreground font-medium opacity-70">{subtitle}</p>
      </div>
    </div>
  );
};

const MenuContent = ({ onRename, onDuplicate, onDelete, onCopy, isFolder }: any) => (
  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in duration-150 origin-top-right">
    <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Edit size={14} /> Rename</button>
    {!isFolder && <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Copy to Clipboard</button>}
    <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Copy size={14} /> Duplicate</button>
    <div className="my-1 border-t border-border mx-1" />
    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold text-destructive hover:bg-destructive/5 rounded transition-all"><Trash size={14} /> Delete</button>
  </div>
);

const TemplateCard = ({ template, onClick, onEdit, onDelete, onPin }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-shrink-0 w-48 group text-left relative" ref={menuRef}>
      <button
        onClick={onClick}
        className={cn(
          "w-full aspect-[3/4] rounded-lg border border-border p-5 shadow-sm transition-all group-hover:border-primary/40 group-hover:shadow-md flex flex-col justify-between overflow-hidden relative",
          template.color === "blue" && "bg-t-blue",
          template.color === "green" && "bg-t-green",
          template.color === "purple" && "bg-t-purple",
          template.color === "amber" && "bg-t-amber",
          template.color === "rose" && "bg-t-rose",
          template.color === "cyan" && "bg-t-cyan",
          template.color === "indigo" && "bg-t-indigo",
          template.color === "slate" && "bg-t-slate",
          !template.color && "bg-white"
        )}
      >
        <div className="p-2.5 bg-primary/5 rounded-md w-fit text-primary group-hover:bg-primary group-hover:text-white transition-all transform group-hover:scale-110">
          <FileText size={20} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">
            {template.name}
            {template.isPinned && <Pin size={10} className="text-primary fill-primary" />}
          </h3>
          <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2 opacity-80">{template.description}</p>
        </div>
      </button>

      {/* More Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-3 right-3 p-1.5 bg-white shadow-sm border border-border rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-50"
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 top-12 w-40 bg-white border border-border shadow-xl rounded-xl p-1 z-[60] origin-top-right animate-in fade-in zoom-in duration-150">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
            className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
          >
            <Edit size={12} /> Edit Data
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}
            className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
          >
            {template.isPinned ? <PinOff size={12} /> : <Pin size={12} />} 
            {template.isPinned ? 'Unpin' : 'Pin Template'}
          </button>
          <div className="my-1 border-t border-slate-100 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this template?')) onDelete(); setShowMenu(false); }}
            className="w-full h-9 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const TemplateSkeleton = () => (
  <div className="flex-shrink-0 w-48 aspect-[3/4] rounded-lg border border-border bg-white p-5 flex flex-col justify-between overflow-hidden animate-pulse">
    <div className="p-2.5 bg-muted/40 rounded-md w-10 h-10" />
    <div className="space-y-3">
      <div className="h-3 bg-muted/20 rounded-full w-3/4" />
      <div className="space-y-1.5">
        <div className="h-2 bg-muted/10 rounded-full w-full" />
        <div className="h-2 bg-muted/10 rounded-full w-2/3" />
      </div>
    </div>
  </div>
);

const ItemSkeleton = ({ mode }: { mode: "grid" | "list" }) => {
  if (mode === "list") {
    return (
      <div className="flex items-center justify-between p-3 bg-white border border-border rounded-lg animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-muted/40 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <div className="w-32 h-2.5 bg-muted/40 rounded-full" />
            <div className="w-20 h-2 bg-muted/20 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 group animate-pulse">
      <div className="aspect-[3/4] rounded-lg border border-border bg-white p-4 flex flex-col gap-3 overflow-hidden shadow-sm">
        <div className="flex justify-center mb-2">
          <div className="w-12 h-4 bg-muted/40 rounded-sm" />
        </div>
        <div className="flex justify-between mb-4">
          <div className="space-y-1.5">
            <div className="w-16 h-1.5 bg-muted/40 rounded-full" />
            <div className="w-20 h-1 bg-muted/20 rounded-full" />
            <div className="w-12 h-1 bg-muted/20 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="w-16 h-1.5 bg-muted/40 rounded-full" />
            <div className="w-10 h-1 bg-muted/20 rounded-full" />
          </div>
        </div>
        <div className="self-center w-3/4 h-2 bg-muted/40 rounded-full mb-4" />
        <div className="border border-muted/20 rounded-sm overflow-hidden flex-1">
          <div className="bg-muted/10 h-3 w-full" />
          <div className="p-2 space-y-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between gap-2">
                <div className="w-4 h-1 bg-muted/40 rounded-full" />
                <div className="flex-1 h-1 bg-muted/20 rounded-full" />
                <div className="w-6 h-1 bg-muted/40 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-1 space-y-1.5">
        <div className="h-2.5 bg-muted/40 rounded-full w-2/3" />
        <div className="h-2 bg-muted/20 rounded-full w-1/4" />
      </div>
    </div>
  );
};

export default Dashboard;
