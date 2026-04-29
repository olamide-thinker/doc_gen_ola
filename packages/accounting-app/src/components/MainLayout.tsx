import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
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
  BookOpen,
  Image as ImageIcon,
  Video,
  ChevronDown,
  Settings as SettingsIcon
} from "../lib/icons/lucide";
import { ServiceDictionaryModal } from "./ServiceDictionaryModal";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useSyncedStore } from "@syncedstore/react";
import { workspaceStore, uiStore } from "../store";
import { useTheme } from "../context/ThemeContext";
import { Building2 } from "lucide-react";

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={cn("w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative overflow-hidden", active ? "bg-primary/5 text-primary shadow-sm" : "text-slate-400 hover:text-slate-200")}>
    <div className={cn("shrink-0 transition-transform group-hover:scale-110", active && "scale-105")}>{icon}</div>
    <span className={cn("text-xs font-black tracking-tight", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
    {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full" />}
  </button>
);

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, logout, businessId, businessName, projectId: activeProjectId, setProject, role, businessAssets } = useAuth();
  const workspaceAction = useSyncedStore(workspaceStore);
  
  const { theme, toggleTheme } = useTheme();
  const uiAction = useSyncedStore(uiStore);
  
  const [activeModule, setActiveModule] = useState<"documents" | "inventory" | "accounting">("documents");
  const [activeView, setActiveView] = useState<"home" | "templates">("home");
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [isServiceDictionaryOpen, setIsServiceDictionaryOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(uiAction.settings.searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      uiAction.settings.searchQuery = localSearch;
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, uiAction]);

  // Sync back if external change
  useEffect(() => {
    setLocalSearch(uiAction.settings.searchQuery);
  }, [uiAction.settings.searchQuery]);

  const projects = (workspaceAction.projects || []) as any[];
  const currentPath = location.pathname;

  return (
    <div className="flex h-screen bg-background text-foreground transition-all duration-300 font-lexend overflow-hidden">
      {/* Unified Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col p-6 space-y-8">
        {/* Company Identity */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl border border-primary/20 shrink-0 shadow-sm shadow-primary/5 flex items-center justify-center overflow-hidden">
            {businessAssets?.logoUrl ? (
              <img
                src={businessAssets.logoUrl}
                alt={businessName || "Company Logo"}
                className="w-full h-full object-cover"
              />
            ) : (
              <ShieldCheck size={20} className="text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[13px] font-black tracking-tighter uppercase text-foreground truncate leading-none">
              {businessName || "Your Company"}
            </h1>
            <p className="text-[8px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mt-1">
              Organization
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-10 overflow-y-auto pr-2 custom-scrollbar">
          {/* Library Section */}
          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50 flex items-center gap-2">
              <Folder size={12} /> Library
            </h3>
            <nav className="space-y-1">
              <SidebarItem
                icon={<Clock size={18} />}
                label="Home"
                active={currentPath === "/dashboard"}
                onClick={() => { setActiveView("home"); navigate("/dashboard"); }}
              />
              <SidebarItem
                icon={<SettingsIcon size={18} />}
                label="Settings"
                active={currentPath === "/settings"}
                onClick={() => navigate(`/settings${activeProjectId ? `?project=${activeProjectId}` : ""}`)}
              />
              <SidebarItem
                icon={<Boxes size={18} />}
                label="All Projects"
                active={currentPath === "/projects"}
                onClick={() => navigate("/projects")}
              />
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
                active={activeModule === "documents" && currentPath === "/dashboard"} 
                onClick={() => { setActiveModule("documents"); navigate("/dashboard"); }} 
              />
              <SidebarItem 
                icon={<LayoutGrid size={18} />} 
                label="Inventory" 
                active={activeModule === "inventory"} 
                onClick={() => { setActiveModule("inventory"); alert("Inventory coming soon"); }} 
              />
              <SidebarItem 
                icon={<Calculator size={18} />} 
                label="Accounting" 
                active={activeModule === "accounting"} 
                onClick={() => { setActiveModule("accounting"); alert("Accounting coming soon"); }} 
              />
              <SidebarItem 
                icon={<Check size={18} />} 
                label="Tasks" 
                active={currentPath === "/tasks"} 
                onClick={() => { setActiveModule("documents"); navigate("/tasks"); }} 
              />
            </nav>
          </div>
        </div>

        {/* Footer / User */}
        <div className="pt-6 border-t border-border/50">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-muted/20 group relative overflow-hidden transition-all hover:bg-muted/40 cursor-pointer">
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {/* Global Navbar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-background/50 backdrop-blur-xl sticky top-0 z-[40] shrink-0">
          <div className="flex items-center gap-6">
             {/* Workspace Breadcrumb / Title */}
             {(() => {
               const activeProject = projects.find((p: any) => p.id === activeProjectId);
               const [isCopied, setIsCopied] = useState(false);
               
               const handleCopyLink = (e: React.MouseEvent) => {
                 e.stopPropagation();
                 const url = `${window.location.origin}/dashboard?project=${activeProjectId}`;
                 navigator.clipboard.writeText(url);
                 setIsCopied(isTrue => !isTrue);
                 setTimeout(() => setIsCopied(false), 2000);
               };

               return (
                 <div className="flex items-center gap-4">
                    {/* <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-xl border border-border/50 select-none">
                       <Boxes size={14} className="text-primary" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Organization</span>
                    </div> */}


                    <div className="relative">
                      <button 
                        onClick={() => setIsProjectSwitcherOpen(!isProjectSwitcherOpen)}
                        className={cn(
                          "flex items-center gap-3 px-2 py-1.5 bg-muted/50 rounded-xl border transition-all hover:bg-muted/80 hover:border-primary/30",
                          isProjectSwitcherOpen ? "border-primary/50 bg-primary/5" : "border-border/50"
                        )}
                      >
                         <div className="flex items-center gap-2">
                            <Building2  size={18} className="text-primary bg-primary/10 p-1 rounded-lg" />
                            <span className="text-sm font-semibold ml-1 text-primary tracking-tight line-clamp-1 max-w-[200px]">
                             {activeProject?.name.charAt(0).toUpperCase() + activeProject?.name.slice(1) || "Select Project"}
                            </span>
                         </div>
                         <ChevronDown size={14} className={cn("text-muted-foreground/50 transition-transform duration-300", isProjectSwitcherOpen && "rotate-180 text-primary")} />
                      </button>

                      {/* Project Switcher Dropdown */}
                      {isProjectSwitcherOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[45]" 
                            onClick={() => setIsProjectSwitcherOpen(false)} 
                          />
                          <div className="absolute top-full left-0 mt-3 w-80 bg-card/95 backdrop-blur-2xl border border-border rounded-3xl shadow-2xl z-[50] p-4 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                             <div className="space-y-4">
                               <div className="flex items-center justify-between px-2">
                                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">Switch Repository</label>
                                 <button 
                                   onClick={handleCopyLink}
                                   className="text-[9px] font-black uppercase text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
                                 >
                                   <Pin size={10} />
                                   {isCopied ? "Link Copied" : "Copy Repo Link"}
                                 </button>
                               </div>
                               
                               <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                 {projects.map((project, idx) => (
                                   <button
                                     key={project?.id || `project-${idx}`}
                                     onClick={() => {
                                       setProject(project.id);
                                       setIsProjectSwitcherOpen(false);
                                     }}
                                     className={cn(
                                       "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group border",
                                       activeProjectId === project.id
                                         ? "bg-primary/10 border-primary/20 text-primary"
                                         : "bg-transparent border-transparent hover:bg-muted hover:border-border text-muted-foreground hover:text-foreground"
                                     )}
                                   >
                                     <div className="flex items-center gap-3">
                                       <div className={cn(
                                         "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                                         activeProjectId === project.id ? "bg-primary/20" : "bg-muted group-hover:bg-card"
                                       )}>
                                         <Boxes size={14} />
                                       </div>
                                       <div className="flex flex-col items-start">
                                          <span className="text-xs font-black tracking-tight">{project.name}</span>
                                          <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Active Project</span>
                                       </div>
                                     </div>
                                     {activeProjectId === project.id && <ShieldCheck size={16} className="text-primary" />}
                                   </button>
                                 ))}
                               </div>

                               <div className="pt-2 border-t border-border/50">
                                 <button
                                   onClick={() => {
                                     navigate("/projects");
                                     setIsProjectSwitcherOpen(false);
                                   }}
                                   className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                                 >
                                   <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                                     <Plus size={14} />
                                   </div>
                                   Create or Manage Repositories
                                 </button>
                               </div>
                             </div>
                          </div>
                        </>
                      )}
                    </div>
                 </div>
               );
             })()}
          </div>

          <div className="h-4 w-px bg-border/50" />

          <div className="flex items-center gap-6">
             {/* Global Search — visible on every module (md+) with a context-aware placeholder */}
             <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-2xl border border-transparent focus-within:border-border focus-within:bg-card transition-all w-[200px] lg:w-[320px]">
                <Search size={14} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder={
                    currentPath.startsWith('/tasks') ? 'Search tasks...' :
                    currentPath.startsWith('/projects') ? 'Search repositories...' :
                    currentPath.startsWith('/team') ? 'Search team...' :
                    'Search...'
                  }
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] font-bold text-foreground placeholder:text-muted-foreground/50 w-full"
                />
                <span className="ml-2 px-1.5 py-0.5 bg-background/50 border border-border/50 rounded text-[8px] font-black opacity-30 select-none">⌘K</span>
             </div>

             <div className="h-6 w-px bg-border/40 mx-1" />

             {/* View Toggles */}
             <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/40">
                <button 
                  onClick={() => uiAction.settings.viewMode = 'grid'}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    uiAction.settings.viewMode === 'grid' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button 
                  onClick={() => uiAction.settings.viewMode = 'list'}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    uiAction.settings.viewMode === 'list' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="List View"
                >
                  <List size={14} />
                </button>
             </div>

               <div className="h-4 w-px bg-border/50 mx-1" />
          <div className="flex items-center gap-2">
             <button 
               onClick={toggleTheme}
               className="p-2 text-muted-foreground hover:text-foreground transition-colors"
               title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
             >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
             </button>


             {/* Stream / Social */}
             <button 
               onClick={() => uiAction.settings.isStreamOpen = !uiAction.settings.isStreamOpen}
               className={cn(
                 "flex items-center gap-2 px-4 py-2 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest relative border",
                 uiAction.settings.isStreamOpen 
                   ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                   : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
               )}
             >
                <Users size={14} />
                <span className="hidden xl:inline">Stream</span>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary border-2 border-background rounded-full animate-pulse" />
             </button>
          </div>
        </div>

             {/* <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Users size={18} />
             </button> */}
        </header>
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>

      {/* Service Dictionary modal — mounted at the layout level so it's
          reachable from any route (dashboard, editor, receipt editor) */}
      <ServiceDictionaryModal
        isOpen={isServiceDictionaryOpen}
        onClose={() => setIsServiceDictionaryOpen(false)}
      />
    </div>
  );
};

export default MainLayout;
