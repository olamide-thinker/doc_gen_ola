import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, ChevronDown, Plus, Mail, Trash, Shield } from '../lib/icons/lucide';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { DocumentMember, MemberRole, normalizeMemberRole } from '../types';
import { useAuth } from '../context/AuthContext';

// Roles a user can be assigned to via this UI. 'owner' is intentionally excluded
// — ownership transfer is not supported through the role dropdown.
const ASSIGNABLE_ROLES: MemberRole[] = ['editor', 'commenter', 'viewer'];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
};

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'project' | 'folder' | 'document';
  id: string;
  name: string;
  members: (string | DocumentMember)[];
  projectMembers?: (string | DocumentMember)[]; 
  onMembersChanged?: (members: DocumentMember[]) => void;
  isOwner?: boolean;
}

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  type,
  id,
  name,
  members: initialMembers,
  projectMembers = [],
  onMembersChanged,
  isOwner = false
}) => {
  const { user: currentUser } = useAuth();
  const [selectedEmail, setSelectedEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('editor');
  const [newProjectMemberEmail, setNewProjectMemberEmail] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalize = (list: (string | DocumentMember)[]): DocumentMember[] => {
    return (list || []).map(m =>
      typeof m === 'string'
        ? { email: m, role: 'editor' as MemberRole }
        : { email: m.email, role: normalizeMemberRole(m.role) },
    );
  };

  const [members, setMembers] = useState<DocumentMember[]>(() => normalize(initialMembers));

  // Only the project owner is allowed to mutate roles (mirrors backend rule).
  // For folder/document level we still let editors manage member access lists.
  const canManageRoles = isOwner;
  const canManage = isOwner || members.find(m => m.email === currentUser?.email)?.role === 'editor';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMembers(normalize(initialMembers));
  }, [initialMembers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filter project members to only show those who don't have access yet
  const availableMembers = useMemo(() => {
    const activeEmails = members.map(m => m.email);
    return normalize(projectMembers).filter(m => !activeEmails.includes(m.email));
  }, [projectMembers, members]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    // For project type, take the email from the dedicated text input. Otherwise
    // pull it from the dropdown of existing project members.
    const email = type === 'project' ? newProjectMemberEmail.trim() : selectedEmail.trim();
    if (!email) return;

    setLoading(true);
    try {
      const updated = await api.addMember(type, id, email, newMemberRole);
      setMembers(updated);
      onMembersChanged?.(updated);
      setSelectedEmail('');
      setNewProjectMemberEmail('');
      setNewMemberRole('editor');
    } catch (error) {
      console.error('Failed to add member:', error);
      alert((error as Error).message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (email: string, role: MemberRole) => {
    if (!canManageRoles) return;
    try {
      const updated = await api.updateMemberRole(type, id, email, role);
      setMembers(updated);
      onMembersChanged?.(updated);
    } catch (error) {
      console.error('Failed to update member role:', error);
      alert((error as Error).message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`Remove ${email} from this ${type}?`)) return;

    try {
      const updated = await api.removeMember(type, id, email);
      setMembers(updated);
      onMembersChanged?.(updated);
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert((error as Error).message || 'Failed to remove member');
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
          {canManage && (
            <form onSubmit={handleAddMember} className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {type === 'project' ? 'Invite a New Member' : 'Grant Access to Project Member'}
              </label>
              <div className="flex gap-2">
                {type === 'project' ? (
                  // Free-text email input for inviting brand-new project members
                  <div className="relative flex-1">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/70" />
                    <input
                      type="email"
                      value={newProjectMemberEmail}
                      onChange={(e) => setNewProjectMemberEmail(e.target.value)}
                      placeholder="member@example.com"
                      disabled={!canManageRoles}
                      className="w-full pl-9 pr-3 py-2.5 bg-muted/30 border border-transparent rounded-xl text-xs focus:bg-card focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                ) : (
                  <div className="relative flex-1" ref={dropdownRef}>
                    <div
                      onClick={() => { if (availableMembers.length > 0) setIsDropdownOpen(!isDropdownOpen); }}
                      className={cn(
                        "w-full pl-9 pr-10 py-2.5 bg-muted/30 border border-transparent rounded-xl flex items-center justify-between cursor-pointer transition-all",
                        isDropdownOpen ? "bg-card border-primary/30 ring-1 ring-primary/20" : "hover:bg-muted/50",
                        availableMembers.length === 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/70" />
                      <span className={cn("text-xs truncate", !selectedEmail && "text-muted-foreground")}>
                        {selectedEmail || (availableMembers.length === 0 ? "No members to add" : "Select a member...")}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn("text-muted-foreground transition-transform duration-200", isDropdownOpen && "rotate-180")}
                      />
                    </div>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.98 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-[110] p-1"
                        >
                          <div className="max-h-48 overflow-y-auto scrollbar-thin">
                            {availableMembers.map(m => (
                              <div
                                key={m.email}
                                onClick={() => { setSelectedEmail(m.email); setIsDropdownOpen(false); }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 rounded-lg cursor-pointer transition-colors group"
                              >
                                <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:border-primary/30 group-hover:bg-primary/20 transition-all font-bold text-[10px] text-primary">
                                  {(m.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{m.email}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Role selector — applies to the new member */}
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                  disabled={type === 'project' && !canManageRoles}
                  className="px-3 py-2.5 bg-muted/30 border border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-muted/50 outline-none focus:bg-card focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    (type === 'project' ? !newProjectMemberEmail || !canManageRoles : !selectedEmail)
                  }
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
              {type === 'project' && !canManageRoles && (
                <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider ml-1">
                  Only the project owner can invite or change member roles
                </p>
              )}
            </form>
          )}

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
                members.map((m) => {
                  const isOwnerRow = m.role === 'owner';
                  return (
                    <div
                      key={m.email}
                      className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/50 group hover:border-border transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 shrink-0">
                          <Mail size={12} className="text-primary/70" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">{m.email}</span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mr-1">Can:</span>
                            {isOwnerRow ? (
                              <span className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                Owner
                              </span>
                            ) : (
                              ASSIGNABLE_ROLES.map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  disabled={!canManageRoles}
                                  onClick={() => handleChangeRole(m.email, role)}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest transition-all border",
                                    m.role === role
                                      ? "bg-primary/20 text-primary border-primary/20"
                                      : "bg-muted/50 text-muted-foreground border-transparent hover:border-border",
                                    !canManageRoles && "cursor-not-allowed opacity-60",
                                  )}
                                >
                                  {ROLE_LABELS[role]}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      {canManage && !isOwnerRow && (
                        <button
                          onClick={() => handleRemoveMember(m.email)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
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
