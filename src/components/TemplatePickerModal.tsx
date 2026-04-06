import React from "react";
import { X, LayoutGrid, FileText, Plus, Search } from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { type TemplateDefinition, TEMPLATES } from "../lib/templates";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: TemplateDefinition) => void;
}

export const TemplatePickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose}
      />
      
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Select a Template</h2>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">Choose a structure for your new document</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search & Categories (Optional) */}
        <div className="px-8 py-4 bg-muted/20 flex items-center gap-4">
            <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                    type="text" 
                    placeholder="Search templates..." 
                    className="w-full pl-9 pr-4 py-2 bg-card border border-border/40 rounded-xl text-xs outline-none focus:border-primary/50 transition-all font-medium"
                />
            </div>
            <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg">All</button>
                <button className="px-4 py-2 text-muted-foreground hover:bg-muted text-[10px] font-black uppercase tracking-widest rounded-lg">Invoices</button>
                <button className="px-4 py-2 text-muted-foreground hover:bg-muted text-[10px] font-black uppercase tracking-widest rounded-lg">Receipts</button>
            </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Blank Template */}
            <button 
              onClick={() => onSelect(TEMPLATES[0])}
              className="group flex flex-col gap-4 p-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Blank Document</h3>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Start with a clean slate and build your own layout</p>
              </div>
            </button>

            {/* Existing Templates */}
            {TEMPLATES.slice(1).map((template) => (
              <button 
                key={template.id}
                onClick={() => onSelect(template)}
                className="group flex flex-col h-full bg-muted/20 hover:bg-card border border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 rounded-2xl transition-all text-left overflow-hidden"
              >
                <div className={cn(
                  "h-24 w-full flex items-center justify-center relative overflow-hidden",
                  template.color === "blue" && "bg-blue-500/10",
                  template.color === "green" && "bg-emerald-500/10",
                  template.color === "purple" && "bg-purple-500/10",
                  template.color === "amber" && "bg-amber-500/10",
                  template.color === "rose" && "bg-rose-500/10",
                  template.color === "cyan" && "bg-cyan-500/10",
                  template.color === "indigo" && "bg-indigo-500/10",
                )}>
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-all duration-300",
                    template.color === "blue" && "bg-blue-500 shadow-blue-500/20",
                    template.color === "green" && "bg-emerald-500 shadow-emerald-500/20",
                    template.color === "purple" && "bg-purple-500 shadow-purple-500/20",
                    template.color === "amber" && "bg-amber-500 shadow-amber-500/20",
                    template.color === "rose" && "bg-rose-500 shadow-rose-500/20",
                    template.color === "cyan" && "bg-cyan-500 shadow-cyan-500/20",
                    template.color === "indigo" && "bg-indigo-500 shadow-indigo-500/20",
                  )}>
                    <FileText size={24} />
                  </div>
                  
                  {/* Micro-preview (faded) */}
                  <div className="absolute inset-x-4 -bottom-2 opacity-5">
                    <div className="h-10 w-full bg-foreground rounded-t-lg" />
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col justify-between whitespace-normal">
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{template.name}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{template.description}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 self-start">
                    <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        template.color === "blue" && "bg-blue-100 text-blue-700",
                        template.color === "green" && "bg-emerald-100 text-emerald-700",
                        template.color === "purple" && "bg-purple-100 text-purple-700",
                        template.color === "amber" && "bg-amber-100 text-amber-700",
                        template.color === "rose" && "bg-rose-100 text-rose-700",
                        template.color === "cyan" && "bg-cyan-100 text-cyan-700",
                        template.color === "indigo" && "bg-indigo-100 text-indigo-700",
                    )}>
                        {template.content?.isReceipt ? 'Receipt' : 'Invoice'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
