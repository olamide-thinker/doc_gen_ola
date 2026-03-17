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
import { motion, AnimatePresence } from "framer-motion";
import { DocumentThumbnail } from "./Thumbnail";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    mutationFn: ({ name, folderId }: { name: string, folderId: string | null }) => {
      const emptyDoc: any = {
        contact: { name: "OLUWAKEMI ISINKAYE", address1: "Prime Waters Garden II", address2: "Lekki Phase 1" },
        title: name,
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        table: { 
          columns: [
            { id: "A", label: "S/N", type: "index", width: "60px" },
            { id: "B", label: "Description", type: "text" },
            { id: "C", label: "Qty", type: "number", width: "80px" },
            { id: "D", label: "Price", type: "number", width: "140px" },
            { id: "E", label: "Total", type: "formula", formula: "C * D", width: "140px" }
          ], 
          rows: [{ B: "New Item", C: 1, D: 0 }], 
          summary: [{ id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }] 
        },
        footer: { notes: "<p>Thank you for your business!</p>", emphasis: [] }
      };
      return api.createDocument(name, emptyDoc as any, folderId);
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

  // --- Handlers ---
  const handleCreateFolder = () => {
    const name = prompt("Folder Name:");
    if (!name) return;
    createFolderMutation.mutate({ name, parentId: currentFolderId });
  };

  const handleCreateDocument = () => {
    const name = prompt("Document Name:");
    if (!name) return;
    createDocMutation.mutate({ name, folderId: currentFolderId });
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
              onClick={handleCreateDocument} 
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-bold text-xs transition-all hover:bg-primary/90"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Doc</span>
            </button>
          </div>
        </header>

        {/* Browser Area */}
        <section className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-0.5">
               <h2 className="text-xs font-bold text-foreground uppercase tracking-widest opacity-80">{currentFolderId ? "Folder Explorer" : "Documents"}</h2>
               <p className="text-[10px] text-muted-foreground font-medium">Manage your workspace assets</p>
            </div>
            <button 
              onClick={handleCreateFolder} 
              className="px-3 py-1.5 border border-border bg-white text-[10px] font-bold tracking-widest text-foreground rounded-md transition-all hover:bg-muted"
            >+ NEW FOLDER</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

export default Dashboard;
