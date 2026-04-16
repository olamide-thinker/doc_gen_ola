import React, { useState } from "react";
import { Plus, FileText, Image as ImageIcon, Video, Trash2, UserIcon } from "../lib/icons/lucide";
import { DocData, FileAttachment } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileShelfProps {
  docData: DocData | undefined;
  onViewFile: (file: FileAttachment) => void;
  onRemoveFile: (fileId: string) => void;
  onAddResourceClick: () => void;
  isReadOnly?: boolean;
}

export const FileShelf: React.FC<FileShelfProps> = ({ 
  docData, 
  onViewFile, 
  onRemoveFile,
  onAddResourceClick,
  isReadOnly = false
}) => {
  const [activeCategory, setActiveCategory] = useState<"all" | "pdf" | "image" | "video">("all");

  const files = docData?.files || [];
  const filteredFiles = activeCategory === "all" 
    ? files 
    : files.filter(f => f.type === activeCategory);

  const categories = [
    { id: "all", label: "All Files", count: files.length },
    { id: "pdf", label: "PDFs", count: files.filter(f => f.type === "pdf").length },
    { id: "image", label: "Images", count: files.filter(f => f.type === "image").length },
    { id: "video", label: "Videos", count: files.filter(f => f.type === "video").length },
  ];

  return (
    <div className="w-full bg-card/40 border border-border/60 rounded-3xl p-6 mb-8 animate-in slide-in-from-top-4 duration-500 no-print">
      <div className="flex flex-col gap-6">
        {/* Header & Categories */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-2 h-8 bg-primary rounded-full" />
               <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-foreground font-lexend">
                  File Resource Center
               </h2>
            </div>
            
            <div className="flex items-center bg-muted/30 p-1 rounded-2xl gap-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative",
                    activeCategory === cat.id 
                      ? "bg-foreground text-background shadow-lg" 
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {cat.label}
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-lg text-[8px]",
                        activeCategory === cat.id ? "bg-background/20" : "bg-muted"
                    )}>
                        {cat.count}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={onAddResourceClick}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 group"
            >
              <Plus size={16} className="transition-transform group-hover:rotate-90" />
              Add Resource
            </button>
          )}
        </div>

        {/* File Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {filteredFiles.map((file) => (
              <motion.div
                layout
                key={file.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onDoubleClick={() => onViewFile(file)}
                title="Double click to view"
                className="group relative h-40 bg-background/40 border border-border/40 rounded-2xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-2xl transition-all"
              >
                {/* Thumbnail Preview logic */}
                <div className="w-full h-full flex items-center justify-center p-4 bg-muted/10">
                   {file.type === "image" && (
                       <img src={file.url} className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform duration-500" alt="" />
                   )}
                   {file.type === "pdf" && (
                       <div className="flex flex-col items-center gap-2 text-primary/60 group-hover:text-primary transition-colors">
                           <FileText size={40} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">PDF Document</span>
                       </div>
                   )}
                   {file.type === "video" && (
                       <div className="flex flex-col items-center gap-2 text-primary/60 group-hover:text-primary transition-colors">
                           <Video size={40} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-1">Video Resource</span>
                       </div>
                   )}
                </div>

                {/* Owner Avatar (Direct on card) */}
                {file.ownerName && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 p-1 bg-background/40 backdrop-blur-md rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                     <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shadow-sm">
                       {file.ownerPhoto ? (
                         <img src={file.ownerPhoto} className="w-full h-full object-cover" alt={file.ownerName} />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center bg-muted">
                           <UserIcon size={12} className="text-muted-foreground" />
                         </div>
                       )}
                     </div>
                     <span className="text-[8px] font-black uppercase tracking-widest text-foreground pr-1">{file.ownerName}</span>
                  </div>
                )}

                {/* Overlay Details */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                   <div className="flex items-center justify-between gap-2 overflow-hidden">
                        <span className="truncate text-[10px] font-black uppercase tracking-widest text-foreground flex-1">
                            {file.name}
                        </span>
                        {!isReadOnly && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); onRemoveFile(file.id); }}
                              className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive hover:text-white transition-all scale-75 group-hover:scale-100"
                          >
                              <Trash2 size={12} />
                          </button>
                        )}
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredFiles.length === 0 && (
             <div className="col-span-full h-40 border-2 border-dashed border-border/40 rounded-3xl flex flex-col items-center justify-center gap-2 text-muted-foreground/30 animate-in fade-in duration-700">
               <ImageIcon size={32} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Deploy resources here</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
