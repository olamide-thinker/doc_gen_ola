import React from 'react';
import { useSyncedStore } from '@syncedstore/react';
import { workspaceStore, type WorkspaceDocument } from '../store';
import { 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Filter,
  Plus,
  Search,
  MapPin,
  Calendar,
  User as UserIcon,
  LayoutGrid,
  List as ListIcon
} from '../lib/icons/lucide';
import { Info as AlertCircle } from '../lib/icons/lucide';
import { cn } from '../lib/utils';
import { type Zone, type Task } from '../types';
import { useNavigate } from 'react-router-dom';

export const TasksDashboard: React.FC = () => {
  const navigate = useNavigate();
  const workspace = useSyncedStore(workspaceStore);
  const documents = (workspace as any).documents || [];

  // Extract all tasks from all plan documents
  const allTasks: { doc: WorkspaceDocument, zone: Zone, task: Task }[] = [];
  documents.forEach((doc: any) => {
    if (doc.content?.isPlan && doc.content?.planData?.zones) {
      doc.content.planData.zones.forEach((zone: Zone) => {
        if (zone.tasks) {
          zone.tasks.forEach((task: Task) => {
            allTasks.push({ doc, zone, task });
          });
        }
      });
    }
  });

  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'progress' | 'done'>('all');

  const filteredTasks = allTasks.filter(t => {
    if (filter === 'all') return true;
    return t.task.status === filter;
  });

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Header */}
      <header className="px-8 pt-8 pb-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Task Center</h1>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Consolidated project workflow</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn("p-1.5 rounded-lg transition-all", viewMode === 'list' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <ListIcon size={16} />
                </button>
             </div>
             <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20">
               <Plus size={14} /> New Manual Task
             </button>
          </div>
        </div>

        {/* Stats & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            <FilterButton 
              active={filter === 'all'} 
              onClick={() => setFilter('all')} 
              label="All Tasks" 
              count={allTasks.length} 
            />
            <FilterButton 
              active={filter === 'pending'} 
              onClick={() => setFilter('pending')} 
              label="Pending" 
              count={allTasks.filter(t => t.task.status === 'pending').length} 
              color="red"
            />
            <FilterButton 
              active={filter === 'progress'} 
              onClick={() => setFilter('progress')} 
              label="In Progress" 
              count={allTasks.filter(t => t.task.status === 'progress').length} 
              color="amber"
            />
            <FilterButton 
              active={filter === 'done'} 
              onClick={() => setFilter('done')} 
              label="Completed" 
              count={allTasks.filter(t => t.task.status === 'done').length} 
              color="emerald"
            />
          </div>

          <div className="flex items-center gap-3">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search tasks, assignees..." 
                  className="pl-9 pr-4 py-2 bg-muted/30 border border-border/50 rounded-xl text-[11px] font-bold outline-none focus:border-primary/50 transition-all w-64"
                />
             </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
             <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={32} />
             </div>
             <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Clear Horizon</h3>
             <p className="text-[10px] font-bold uppercase tracking-tighter">No tasks found matching your filters</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredTasks.map(({ doc, zone, task }) => (
              <div 
                key={task.id}
                onClick={() => navigate(`/plan/${doc.id}`)}
                className="group flex items-center gap-4 p-4 bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 rounded-2xl transition-all cursor-pointer"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/50 transition-colors",
                  task.status === 'done' ? 'bg-emerald-500/10 text-emerald-500' : 
                  task.status === 'progress' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                )}>
                  {task.status === 'done' ? <CheckCircle2 size={18} /> : 
                   task.status === 'progress' ? <Clock size={18} /> : <AlertCircle size={18} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-xs font-bold truncate group-hover:text-primary transition-colors">{task.description}</h4>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full",
                      task.priority === 'high' ? 'bg-red-500/10 text-red-500' : 
                      task.priority === 'med' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                    )}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><MapPin size={10} /> {zone.name}</span>
                    <span>•</span>
                    <span className="truncate">{doc.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 pr-4">
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center">
                         <UserIcon size={12} className="text-muted-foreground/50" />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px]">{task.assignee}</span>
                   </div>
                   <div className="w-32 hidden lg:flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                      <Calendar size={12} />
                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}</span>
                   </div>
                   <ChevronRight size={16} className="text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTasks.map(({ doc, zone, task }) => (
              <div 
                key={task.id}
                onClick={() => navigate(`/plan/${doc.id}`)}
                className="group p-5 bg-card border border-border/50 hover:border-primary/40 rounded-3xl transition-all cursor-pointer flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                   <div className={cn(
                     "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                     task.status === 'done' ? 'bg-emerald-500/10 text-emerald-500' : 
                     task.status === 'progress' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                   )}>
                     {task.status}
                   </div>
                   <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">#{task.id}</div>
                </div>

                <h4 className="text-sm font-bold mb-4 flex-1 line-clamp-3 group-hover:text-primary transition-colors">{task.description}</h4>

                <div className="space-y-3 pt-4 border-t border-border/40">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                      <MapPin size={12} className="text-primary" />
                      <span className="truncate">{zone.name}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center overflow-hidden">
                           <UserIcon size={12} className="text-muted-foreground/50" />
                        </div>
                        <span className="text-[10px] font-bold text-foreground/70">{task.assignee}</span>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        task.priority === 'high' ? 'bg-red-500' : task.priority === 'med' ? 'bg-amber-500' : 'bg-blue-500'
                      )} />
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

const FilterButton = ({ active, onClick, label, count, color }: { active: boolean, onClick: () => void, label: string, count: number, color?: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-xl transition-all border shrink-0",
      active 
        ? "bg-card border-primary/30 text-foreground shadow-sm" 
        : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
    )}
  >
    {color && <div className={cn("w-1.5 h-1.5 rounded-full", `bg-${color}-500`)} />}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{count}</span>
  </button>
);


