import React, { useState, useEffect } from 'react';
import { useSyncedStore } from '@syncedstore/react';
import { workspaceStore } from '../../store';
import { FolderOpen, MoreVertical, ArchiveIcon, Edit2, Archive, RotateCcw, Trash2, CheckCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
  createdAt: string;
  memberCount: number;
}

const ProjectsSettings: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const workspaceAction = useSyncedStore(workspaceStore);

  useEffect(() => {
    try {
      const allProjects = (workspaceAction.projects || []) as any[];
      const mappedProjects: Project[] = allProjects.map(p => ({
        id: p.id || '',
        name: p.name || 'Untitled Project',
        status: p.archived ? 'archived' : 'active',
        createdAt: p.createdAt || new Date().toISOString(),
        memberCount: (p.members || []).length,
      }));
      setProjects(mappedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceAction.projects]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close menu if clicking outside any menu container
      if (!target.closest('[data-menu-container]')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getProjectFromStore = (projectId: string) => {
    return (workspaceAction.projects || []).find((p: any) => p.id === projectId);
  };

  const handleRename = (projectId: string) => {
    const project = getProjectFromStore(projectId);
    if (project) {
      setEditingId(projectId);
      setEditingName(project.name);
      setOpenMenuId(null);
    }
  };

  const handleSaveRename = (projectId: string) => {
    if (!editingName.trim()) {
      setMessage({ type: 'error', text: 'Project name cannot be empty' });
      return;
    }

    const project = getProjectFromStore(projectId);
    if (project) {
      project.name = editingName.trim();
      setMessage({ type: 'success', text: 'Project renamed successfully' });
      setEditingId(null);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleArchive = (projectId: string) => {
    const project = getProjectFromStore(projectId);
    if (project) {
      project.archived = true;
      setMessage({ type: 'success', text: 'Project archived' });
      setOpenMenuId(null);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleUnarchive = (projectId: string) => {
    const project = getProjectFromStore(projectId);
    if (project) {
      project.archived = false;
      setMessage({ type: 'success', text: 'Project restored' });
      setOpenMenuId(null);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleDelete = (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    const projectIndex = (workspaceAction.projects || []).findIndex((p: any) => p.id === projectId);
    if (projectIndex !== -1) {
      workspaceAction.projects!.splice(projectIndex, 1);
      setMessage({ type: 'success', text: 'Project deleted successfully' });
      setOpenMenuId(null);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const activeProjects = projects.filter(p => p.status === 'active');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 border rounded-xl ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          }`}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Active Projects */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Active Projects ({activeProjects.length})
        </h3>

        {activeProjects.length === 0 ? (
          <div className="p-6 text-center bg-muted/30 rounded-xl border border-border">
            <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No active projects</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeProjects.map(project => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors group relative"
              >
                <div className="flex-1">
                  {editingId === project.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => handleSaveRename(project.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveRename(project.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full px-3 py-1.5 bg-muted/30 border border-primary/30 rounded-lg focus:outline-none focus:bg-card text-sm font-medium text-foreground"
                    />
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          {project.memberCount} members
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Menu Button */}
                <div className="relative" data-menu-container>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Dropdown Menu */}
                  {openMenuId === project.id && (
                    <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50" data-menu-container>
                      <button
                        onClick={() => handleRename(project.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
                      >
                        <Edit2 className="w-4 h-4" />
                        Rename
                      </button>
                      <button
                        onClick={() => handleArchive(project.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors text-left border-t border-border"
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left border-t border-border"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archived Projects */}
      {archivedProjects.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArchiveIcon className="w-4 h-4" />
              Archived Projects ({archivedProjects.length})
            </h3>

            <div className="space-y-2">
              {archivedProjects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg group relative"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Archived</p>
                  </div>

                  {/* Menu Button */}
                  <div className="relative" data-menu-container>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === project.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50" data-menu-container>
                        <button
                          onClick={() => handleRename(project.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
                        >
                          <Edit2 className="w-4 h-4" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleUnarchive(project.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors text-left border-t border-border"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left border-t border-border"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectsSettings;
