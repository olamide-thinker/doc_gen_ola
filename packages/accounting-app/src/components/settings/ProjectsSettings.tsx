import React, { useState, useEffect } from 'react';
import { useSyncedStore } from '@syncedstore/react';
import { workspaceStore } from '../../store';
import { FolderOpen, MoreVertical, ArchiveIcon } from 'lucide-react';

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
                className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                      {project.memberCount} members
                    </span>
                  </div>
                </div>

                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
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
                  className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg opacity-60"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Archived</p>
                  </div>

                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
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
