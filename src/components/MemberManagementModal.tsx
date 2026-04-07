import React, { useState } from 'react';
import { X, Plus, Trash, Users, Mail, Shield } from '../lib/icons/lucide';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'project' | 'folder' | 'document';
  id: string;
  name: string;
  members: string[];
}

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  type,
  id,
  name,
  members
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    
    setLoading(true);
    try {
      await api.addMember(type, id, newEmail.trim());
      setNewEmail('');
    } catch (error) {
      console.error('Failed to add member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`Remove ${email} from this ${type}?`)) return;
    
    try {
      await api.removeMember(type, id, email);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Manage Access</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                {type}: {name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleAddMember} className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Add Member by Email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="email"
                  placeholder="colleague@gmail.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-muted/30 border border-transparent focus:border-primary/30 rounded-xl outline-none text-xs transition-all"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={loading || !newEmail.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Current Members ({members.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
              {members.length === 0 ? (
                <div className="text-center py-8 bg-muted/10 rounded-xl border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No specific members added yet.</p>
                </div>
              ) : (
                members.map((email) => (
                  <div 
                    key={email}
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/50 group hover:border-border transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                        <Mail size={12} className="text-primary/70" />
                      </div>
                      <span className="text-xs font-medium text-foreground">{email}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveMember(email)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border-t border-border flex items-center gap-3">
          <Shield size={14} className="text-amber-500 shrink-0" />
          <p className="text-[9px] text-muted-foreground leading-relaxed">
            Members of a {type} inherit permissions to see its basic information, but may still be restricted from seeing nested child items.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
