import React from "react";
import { X, LayoutGrid, FileText, Plus, Search } from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { type TemplateDefinition, TEMPLATES } from "../lib/templates";
import { API_BASE } from "../lib/workspace-persist";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: TemplateDefinition) => void;
  onFileUpload?: (file: { name: string, type: 'pdf' | 'image' | 'video', url: string, size: number }, intent?: string) => void;
}

export const TemplatePickerModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSelect,
  onFileUpload 
}) => {
  const fileInputRefs = {
    pdf: React.useRef<HTMLInputElement>(null),
    image: React.useRef<HTMLInputElement>(null),
    video: React.useRef<HTMLInputElement>(null),
  };
  const [isUploading, setIsUploading] = React.useState(false);

  const handleNativeUpload = async (type: 'pdf' | 'image' | 'video', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;
    setIsUploading(true);
    try {
      // 1. Get auth token
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append('file', file);

      // 3. Upload to backend
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      // 4. Trigger callback with server URL
      onFileUpload({
        name: file.name,
        type: type,
        url: data.url,
        size: file.size
      }, (e.target as any).dataset.type);
      
      onClose();
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset
    }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose}
      />
      
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
        {isUploading && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-[110] flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-3">
              <Plus className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Uploading Resource...</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground font-lexend uppercase tracking-wider">Add File</h2>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">Choose a resource type or document structure</p>
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
                <button className="px-4 py-2 text-muted-foreground hover:bg-muted text-[10px] font-black uppercase tracking-widest rounded-lg">Plans</button>
            </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin space-y-10">
          {/* File Type Section */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
              File Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'pdf', label: 'PDF Document', icon: FileText, color: 'blue', accept: 'application/pdf' },
                { id: 'image', label: 'Image / Photo', icon: Plus, color: 'emerald', accept: 'image/*' },
                { id: 'video', label: 'Video Clip', icon: Plus, color: 'purple', accept: 'video/*' },
              ].map((type) => (
                <div key={type.id} className="relative">
                  <label
                    htmlFor={`file-upload-${type.id}`}
                    className="group w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/60 hover:border-primary/40 hover:bg-card transition-all text-left cursor-pointer"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-300 group-hover:scale-110",
                      type.color === 'blue' && "bg-blue-500 shadow-blue-500/20",
                      type.color === 'emerald' && "bg-emerald-500 shadow-emerald-500/20",
                      type.color === 'purple' && "bg-purple-500 shadow-purple-500/20",
                    )}>
                      <type.icon size={24} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
                        {type.label}
                      </h4>
                      <p className="text-[9px] text-muted-foreground mt-0.5 font-bold uppercase tracking-tighter opacity-60">Upload resource</p>
                    </div>
                  </label>
                  <input
                    id={`file-upload-${type.id}`}
                    type="file"
                    onChange={(e) => handleNativeUpload(type.id as any, e)}
                    className="hidden"
                    accept={type.accept}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Construction Planning */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
              Construction Planning
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label
                  htmlFor="file-upload-plan"
                  className="group w-full flex items-center gap-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 transition-all duration-300 group-hover:scale-110">
                    <LayoutGrid size={24} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground group-hover:text-amber-500 transition-colors">
                      Floor Plan / Blueprint
                    </h4>
                    <p className="text-[9px] text-muted-foreground mt-0.5 font-bold uppercase tracking-tighter opacity-60">Upload PDF for zone mapping & tasks</p>
                  </div>
                </label>
                <input
                  id="file-upload-plan"
                  type="file"
                  onChange={(e) => handleNativeUpload('pdf', e)}
                  data-type="plan"
                  className="hidden"
                  accept="application/pdf"
                />
              </div>
            </div>
          </section>

          {/* Template Section */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 px-1">
              Select a Template
            </h3>
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
          </section>
        </div>
      </div>
    </div>
  );
};
