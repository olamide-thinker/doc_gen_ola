import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Plus, Trash, ArrowLeft, Boxes, Check, Users, Clock, Link, Crown } from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { api, isPlayground, getPlaygroundId } from "../lib/api";
import { cn } from "../lib/utils";
import { CreateProjectModal } from "./CreateProjectModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type ProjectFilter = 'all' | 'owned' | 'shared';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, setProject } = useAuth();

  const [isConnecting, setIsConnecting] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProjectFilter>('all');

  const savedActive = localStorage.getItem("invsys_active_project") || "playground";

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    enabled: !!currentUser,
  });

  // Filter the projects by owned/shared. isOwner is supplied by the backend
  // so we fall back to comparing ownerId against the current user uid.
  const filteredProjects = useMemo(() => {
    if (!currentUser) return projects;
    return projects.filter((p) => {
      const isOwner = p.isOwner ?? (p.ownerId === currentUser.uid);
      if (filter === 'owned') return isOwner;
      if (filter === 'shared') return !isOwner;
      return true;
    });
  }, [projects, filter, currentUser]);

  const ownedCount = useMemo(
    () => projects.filter((p) => (p.isOwner ?? (p.ownerId === currentUser?.uid))).length,
    [projects, currentUser],
  );
  const sharedCount = projects.length - ownedCount;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ name, email }: { name: string, email: string }) => api.createProject(name, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // 2. Ensure we are connected to the sync server for background stashing
  React.useEffect(() => {
    const init = async () => {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const saved = localStorage.getItem("invsys_active_project") || "playground";
        const activeId = isPlayground(saved) 
          ? getPlaygroundId(currentUser.uid)
          : saved;
        
        const { workspaceProvider } = (await import("../store")).connectProject(activeId, token);
        
        workspaceProvider?.on('synced', () => {
          setIsConnecting(false);
        });
        
        setTimeout(() => setIsConnecting(false), 2000);
      } catch (err) {
        console.error("Failed to connect projects:", err);
        setIsConnecting(false);
      }
    };
    init();
  }, [currentUser]);

  const copyLink = (projectId: string) => {
    const url = `${window.location.origin}/dashboard?project=${projectId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openProject = (projectId: string) => {
    setProject(projectId);
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (id === "playground") { alert("The Playground project cannot be deleted."); return; }
    if (!confirm("Delete this project and all its content? This cannot be undone.")) return;
    
    await deleteMutation.mutateAsync(id);
    
    if (savedActive === id) {
      localStorage.setItem("invsys_active_project", "playground");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground font-lexend scrollbar-thin">
      {/* Sub-Header / Toolbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Project Repositories</h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {projects.length} workspace{projects.length !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={14} />
          New Repository
        </button>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Filter Tabs */}
        {!isConnecting && projects.length > 0 && (
          <div className="flex items-center gap-1 mb-8 bg-muted/30 p-1 rounded-xl border border-border w-fit">
            {([
              { key: 'all', label: 'All', count: projects.length },
              { key: 'owned', label: 'My Projects', count: ownedCount },
              { key: 'shared', label: 'Shared with Me', count: sharedCount },
            ] as { key: ProjectFilter; label: string; count: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === tab.key
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                  filter === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {isConnecting ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary"
            />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing workspaces...</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Establishing secure connection to database</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
              <Boxes size={32} className="text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No projects yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Create your first project to get started</p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              Create Project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
              <FolderOpen size={24} className="text-muted-foreground/40" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              {filter === 'owned' ? 'You don\'t own any projects yet' : 'No projects shared with you yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredProjects.map((project, i) => {
                const isActive = savedActive === project.id;
                const isPlaygroundProj = isPlayground(project.id);
                const memberCount = (project.members || []).length;
                const isOwner = project.isOwner ?? (project.ownerId === currentUser?.uid);
                const owner = project.owner;
                const ownerLabel = isOwner
                  ? 'You'
                  : (owner?.fullName || owner?.email?.split('@')[0] || 'Unknown');
                const ownerInitial = (owner?.fullName || owner?.email || '?').trim().charAt(0).toUpperCase();
                const createdDate = project.createdAt
                  ? new Date(project.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "—";

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "group relative flex flex-col gap-0 border rounded-3xl overflow-hidden transition-all cursor-pointer hover:shadow-2xl hover:border-primary/30",
                      isActive ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:bg-muted/20"
                    )}
                    onClick={() => openProject(project.id)}
                  >
                    {/* Top colour bar */}
                    <div className={cn(
                      "h-1.5 w-full",
                      isPlaygroundProj ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-gradient-to-r from-primary to-primary/60"
                    )} />

                    <div className="p-6 flex flex-col gap-5 flex-1">
                      {/* Icon + name */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-11 h-11 rounded-2xl flex items-center justify-center border",
                            isPlaygroundProj
                              ? "bg-violet-500/10 border-violet-500/20 text-violet-500"
                              : isActive
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-muted border-border text-muted-foreground"
                          )}>
                            {isPlaygroundProj ? <Boxes size={20} /> : <FolderOpen size={20} />}
                          </div>
                          <div className="flex flex-col">
                            <h2 className="text-base font-black tracking-tight text-foreground leading-none group-hover:text-primary transition-colors">
                              {project.name || "Untitled Project"}
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5">
                              {isActive && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-md">
                                  <Check size={8} /> Active
                                </span>
                              )}
                              {isOwner ? (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                                  <Crown size={8} /> Owner
                                </span>
                              ) : (
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                                  <Users size={8} /> Shared
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions (visible on hover) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => copyLink(project.id)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                            title="Copy project link"
                          >
                            {copiedId === project.id ? <Check size={14} className="text-primary" /> : <Link size={14} />}
                          </button>
                          {isOwner && !isPlaygroundProj && (
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              title="Delete project"
                            >
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Owner pill */}
                      <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl border border-border/40">
                        {owner?.photo ? (
                          <img
                            src={owner.photo}
                            alt={ownerLabel}
                            className="w-7 h-7 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                            {ownerInitial}
                          </div>
                        )}
                        <div className="flex flex-col leading-tight min-w-0">
                          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">
                            Created by
                          </span>
                          <span className="text-[11px] font-bold text-foreground truncate">
                            {ownerLabel}
                          </span>
                        </div>
                      </div>

                      {/* Stats (member count only — folder/doc counts require per-project query) */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                          <Users size={12} className="opacity-60" />
                          <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-1.5 mt-auto text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest">
                        <Clock size={10} />
                        <span>Created {createdDate}</span>
                      </div>
                    </div>

                    {/* Open overlay on hover */}
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                      <div className="px-3 py-1.5 bg-foreground text-background text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                        Open →
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (name) => {
          if (!currentUser?.email) return;
          const newProj = await createMutation.mutateAsync({ name, email: currentUser.email });
          localStorage.setItem("invsys_active_project", newProj.id);
          setIsCreateOpen(false);
          navigate("/dashboard");
        }}
      />
    </div>
  );
};

export default ProjectsPage;
