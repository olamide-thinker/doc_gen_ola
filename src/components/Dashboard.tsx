import React, { useState, useEffect, useRef } from "react";
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
  UserIcon
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api, type Folder as FolderType, type Document as DocumentType } from "../lib/api";
import { type TemplateDefinition } from "../lib/templates";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentThumbnail } from "./Thumbnail";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EditTemplateModal } from "./EditTemplateModal";
import { Pin, PinOff } from "lucide-react";
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
  useSortable
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

  // --- Queries ---
  const { data: folderItems = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: () => api.getFolders(currentFolderId),
  });

  const { data: docItems = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ["documents", currentFolderId],
    queryFn: () => api.getDocuments(currentFolderId),
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.getTemplates(),
    enabled: !currentFolderId
  });

  const items = [
    ...folderItems.map(f => ({ ...f, id: `f-${f.id}`, _type: 'folder' as const, _realId: f.id })),
    ...docItems.map(d => ({ ...d, id: `d-${d.id}`, _type: 'document' as const, _realId: d.id }))
  ];

  const isLoading = isLoadingFolders || isLoadingDocs;

  // --- Mutations ---
  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string, parentId: string | null }) => api.createFolder(name, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] }),
  });

  const createDocMutation = useMutation({
    mutationFn: ({ name, folderId, template }: { name: string, folderId: string | null, template?: TemplateDefinition }) => {
      const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      
      const defaultData: any = {
        contact: { name: "OLUWAKEMI ISINKAYE", address1: "Prime Waters Garden II", address2: "Lekki Phase 1" },
        title: name,
        date: now,
        table: { 
          columns: [
            { id: "A", label: "S/N", type: "index", width: "60px" },
            { id: "B", label: "Description", type: "text" },
            { id: "C", label: "Unit", type: "text", width: "80px" },
            { id: "D", label: "Qty", type: "number", width: "80px" },
            { id: "E", label: "Price", type: "number", width: "140px" },
            { id: "F", label: "Total", type: "formula", formula: "D * E", width: "140px" }
          ], 
          rows: [{ B: "New Item", C: "pcs", D: 1, E: 0 }], 
          summary: [{ id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }] 
        },
        footer: { notes: "<p>Thank you for your business!</p>", emphasis: [] }
      };

      const docContent: any = template 
        ? { 
            ...defaultData, 
            ...template.content, 
            table: { 
              ...defaultData.table, 
              ...(template.content?.table || {})
            },
            footer: { 
              ...defaultData.footer, 
              ...(template.content?.footer || {})
            }
          }
        : defaultData;

      // Ensure title/date are updated
      docContent.title = name || template?.name || "Untitled";
      docContent.date = now;

      return api.createDocument(docContent.title, docContent as any, folderId);
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] });
      navigate(`/editor/${newDoc.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (item: any) => item._type === 'folder' ? api.deleteFolder(item._realId) : api.deleteDocument(item._realId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.duplicateDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] }),
  });

  const renameMutation = useMutation<any, Error, { item: any, newName: string }>({
    mutationFn: ({ item, newName }: { item: any, newName: string }) => 
      item._type === 'folder' ? api.renameFolder(item._realId, newName) : api.updateDocument(item._realId, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] });
    },
  });

  const moveMutation = useMutation<any, Error, { item: any, targetFolderId: string | null }>({
    mutationFn: ({ item, targetFolderId }: { item: any, targetFolderId: string | null }) => 
      item._type === 'folder' ? api.moveFolder(item._realId, targetFolderId) : api.moveDocument(item._realId, targetFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["documents", currentFolderId] });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (template: TemplateDefinition) => api.saveTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setEditingTemplate(null);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const pinTemplateMutation = useMutation({
    mutationFn: (id: string) => api.togglePinTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  // --- Handlers ---
  const handleCreateFolder = () => {
    const name = prompt("Folder Name:");
    if (!name) return;
    createFolderMutation.mutate({ name, parentId: currentFolderId });
  };

  const handleCreateDocument = (template?: TemplateDefinition) => {
    const defaultName = template ? template.name : "New Document";
    const name = prompt("Document Name:", defaultName);
    if (name === null) return;
    createDocMutation.mutate({ name: name || defaultName, folderId: currentFolderId, template });
  };

  const handleDelete = (item: any) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    deleteMutation.mutate(item);
  };

  const handleDuplicate = (item: any) => {
    if (item._type === 'folder') return alert("Folder duplication coming soon!");
    duplicateMutation.mutate(item._realId);
  };

  const handleRename = (item: any) => {
    const newName = prompt("New Name:", item.name);
    if (!newName || newName === item.name) return;
    renameMutation.mutate({ item, newName });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeItem = items.find(i => i.id === active.id);
    const overItem = items.find(i => i.id === over.id);

    if (overItem && overItem._type === 'folder' && activeItem && activeItem.id !== overItem.id) {
       moveMutation.mutate({ item: activeItem, targetFolderId: overItem._realId });
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
        <section className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin">

          {!currentFolderId && (
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
                      onDelete={() => deleteTemplateMutation.mutate(template.id)}
                      onPin={() => pinTemplateMutation.mutate(template.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-0.5">
               <h2 className="text-xs font-bold text-foreground uppercase tracking-widest opacity-80">{currentFolderId ? "Folder Explorer" : "All Documents"}</h2>
               <p className="text-[10px] text-muted-foreground font-medium">Manage your workspace assets</p>
            </div>
            <button 
              onClick={handleCreateFolder} 
              className="px-3 py-1.5 border border-border bg-white text-[10px] font-bold tracking-widest text-foreground rounded-md transition-all hover:bg-muted"
            >+ NEW FOLDER</button>
          </div>

          {isLoading ? (
            <div className={cn("gap-6", viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "flex flex-col gap-2")}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <ItemSkeleton key={i} mode={viewMode} />
              ))}
            </div>
          ) : (
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
                        onDelete={() => handleDelete(item)}
                        onDuplicate={() => handleDuplicate(item)}
                        onRename={() => handleRename(item)}
                        onClick={() => item._type === 'folder' ? navigate(`/dashboard?folder=${item._realId}`) : navigate(`/editor/${item._realId}`)}
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
          )}
        </section>
      </main>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal 
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(updated) => saveTemplateMutation.mutate(updated)}
        />
      )}
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

const ItemCard = ({ item, mode, onClick, onDelete, onDuplicate, onRename }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const isFolder = item._type === 'folder';
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (mode === "list") {
    return (
      <div onClick={onClick} className="flex items-center justify-between p-3 bg-white border border-border rounded-lg cursor-pointer group transition-all hover:border-primary/40 hover:bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-md flex items-center justify-center border", isFolder ? "bg-amber-50 text-amber-600 border-amber-200/50" : "bg-primary/5 text-primary border-primary/20")}>
            {isFolder ? <Folder size={18} /> : <FileText size={18} />}
          </div>
          <div className="flex flex-col">
            <p className="text-xs font-semibold tracking-tight">{item.name}</p>
            <p className="text-[10px] text-muted-foreground font-medium">
              {isFolder ? "Folder" : "Document"} • {new Date(item.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-all border border-transparent hover:border-border"
          ><MoreHorizontal size={16} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 group relative cursor-pointer">
      <div 
        onClick={onClick}
        className={cn(
          "aspect-[3/4] rounded-lg border border-border bg-white shadow-sm transition-all relative overflow-hidden flex flex-col items-center justify-center",
          "hover:border-primary/40 hover:shadow-md",
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
        
        {/* Actions Button */}
        <div className="absolute top-3 right-3" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
            className="p-1.5 bg-white/90 backdrop-blur shadow-sm border border-border rounded-md hover:bg-white text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
          ><MoreHorizontal size={14} /></button>
          {showMenu && <MenuContent onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />}
        </div>
      </div>
      <div className="px-1" onClick={onClick}>
        <p className="text-[12px] font-semibold truncate tracking-tight text-slate-700">{item.name}</p>
        <p className="text-[10px] text-muted-foreground font-medium opacity-70">
          {isFolder ? "Folder" : "Document"}
        </p>
      </div>
    </div>
  );
};

const MenuContent = ({ onRename, onDuplicate, onDelete }: any) => (
  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in duration-150 origin-top-right">
    <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="w-full h-9 flex items-center gap-2 px-3 text-[11px] font-semibold hover:bg-muted text-slate-600 rounded transition-all"><Edit size={14} /> Rename</button>
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
        className="w-full aspect-[3/4] rounded-lg border border-border bg-white p-5 shadow-sm transition-all group-hover:border-primary/40 group-hover:shadow-md flex flex-col justify-between overflow-hidden relative"
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
      <div className="h-3 bg-muted/40 rounded-full w-3/4" />
      <div className="space-y-1.5">
        <div className="h-2 bg-muted/20 rounded-full w-full" />
        <div className="h-2 bg-muted/20 rounded-full w-2/3" />
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
