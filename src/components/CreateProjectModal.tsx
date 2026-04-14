import React, { useState } from "react";
import { Plus, X, FolderOpen, ShieldCheck } from "../lib/icons/lucide";
import { motion, AnimatePresence } from "framer-motion";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleInitialize = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      setName("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/60 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-card rounded-[32px] shadow-2xl border border-white/10 p-8 overflow-hidden"
        >
          {/* Subtle Background Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-lime-400/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-lime-400/10 rounded-2xl flex items-center justify-center">
              <FolderOpen className="text-lime-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">New Project</h2>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none mt-1">Specialist Workspace</p>
            </div>
            <button 
                onClick={onClose}
                className="ml-auto p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all"
            >
                <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Assignment</label>
              <input
                type="text"
                autoFocus
                value={name}
                disabled={loading}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. NNPC Pipeline Expansion"
                className="w-full h-14 px-6 bg-muted/40 border border-border focus:border-lime-400/50 focus:bg-card rounded-2xl outline-none text-sm font-bold tracking-tight transition-all"
              />
              {error && (
                <p className="text-[10px] text-destructive font-bold uppercase tracking-widest ml-1 animate-in fade-in slide-in-from-top-1">
                  {error}
                </p>
              )}
            </div>

            <div className="bg-lime-400/5 border border-lime-400/10 rounded-2xl p-4 flex items-center gap-3">
              <ShieldCheck className="text-lime-400 shrink-0" size={18} />
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                This project will be isolated from your Playground data, providing a dedicated environment for your team's specialist work.
              </p>
            </div>

            <button
              onClick={handleInitialize}
              disabled={!name.trim() || loading}
              className="w-full h-14 bg-lime-400 text-lime-950 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-lime-400/10 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? "Initializing..." : "Initialize Workspace"}
              {!loading && <Plus size={18} strokeWidth={3} />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
