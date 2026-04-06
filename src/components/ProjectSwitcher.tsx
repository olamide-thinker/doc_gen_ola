import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, LayoutGrid, Boxes, Calculator, Check, FolderOpen } from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { WorkspaceProject } from "../store";

interface ProjectSwitcherProps {
  projects: WorkspaceProject[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  activeProjectId,
  onSelect,
  onCreateNew,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Project Selector Pill */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-3 px-5 h-11 hover:bg-white/5 transition-all group rounded-2xl",
            isOpen && "bg-white/5"
          )}
        >
          <div className="w-5 h-5 rounded-lg bg-lime-400/20 flex items-center justify-center">
            <LayoutGrid size={12} className="text-lime-400" />
          </div>
          <span className="text-[12px] font-bold text-white tracking-tight min-w-[120px] text-left line-clamp-1">
            {activeProject?.name}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "text-white/40 transition-transform duration-300",
              isOpen && "rotate-180 text-lime-400"
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-3 w-[280px] bg-card/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl z-[100] p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
            <div className="px-3 py-2 mb-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Switch Workspace</label>
            </div>
            
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-none">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelect(project.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group",
                    activeProjectId === project.id
                      ? "bg-lime-400 text-lime-950 font-black"
                      : "hover:bg-white/5 text-muted-foreground hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                      activeProjectId === project.id ? "bg-lime-950/10" : "bg-muted group-hover:bg-white/10"
                    )}>
                      {project.id === "playground" ? <Boxes size={14} /> : <FolderOpen size={14} />}
                    </div>
                    <span className="text-xs tracking-tight">{project.name}</span>
                  </div>
                  {activeProjectId === project.id && <Check size={16} />}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-lime-400 hover:bg-lime-400/10 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-lime-400/20 flex items-center justify-center">
                  <Plus size={14} />
                </div>
                New Specialist Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
