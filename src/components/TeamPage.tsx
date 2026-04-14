import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, UserPlus, Trash2, Shield, ShieldCheck,
  Check, Link, Crown, Eye, Edit2, Lock, UserX, AlertTriangle, X
} from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { API_BASE } from "../lib/workspace-persist";

type MemberRole = "owner" | "admin" | "editor" | "viewer";

interface TeamMember {
  email: string;
  role: MemberRole;
  userId?: string;
}

const ROLE_META: Record<MemberRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  owner:  { label: "Owner",  icon: <Crown size={12} />,     color: "text-amber-500",  description: "Full access. Can delete the project." },
  admin:  { label: "Admin",  icon: <Shield size={12} />,    color: "text-blue-500",   description: "Can manage team and all content." },
  editor: { label: "Editor", icon: <Edit2 size={12} />,     color: "text-primary",    description: "Can create and edit documents." },
  viewer: { label: "Viewer", icon: <Eye size={12} />,       color: "text-muted-foreground", description: "Read-only access." },
};

const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, businessId, businessName: authBusinessName, projectId } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [localProjectName, setLocalProjectName] = useState("Your Project");
  const [isLoading, setIsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>("editor");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const isOwner = currentUser?.uid === ownerId;

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const token = await currentUser?.getIdToken();
        const response = await fetch(`${API_BASE}/workspace/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success && result.data) {
          const data = result.data;
          setLocalProjectName(data.name || "Your Project");
          setOwnerId(data.ownerId || null);
          const rawMembers: any[] = data.members || [];
          setMembers(rawMembers.map(m => ({
            email: m.email,
            role: m.role as MemberRole,
            userId: m.userId
          })));
        }
      } catch (e) {
        console.error("Failed to load team:", e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [projectId, currentUser]);

  const handleInvite = async () => {
    setInviteError("");
    const email = newEmail.trim().toLowerCase();

    if (!email.includes("@")) { setInviteError("Enter a valid email address."); return; }
    if (members.some(m => m.email === email)) { setInviteError("This person is already on the team."); return; }
    if (email === currentUser?.email) { setInviteError("You're already the owner."); return; }

    setIsInviting(true);
    try {
      await api.addMember('project', projectId!, email);
      setMembers(prev => [...prev, { email, role: newRole }]);
      setNewEmail("");
      setIsInviteModalOpen(false);
    } catch (e: any) {
      setInviteError(e.message || "Failed to add member.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from the team?`)) return;
    try {
      await api.removeMember('project', projectId!, email);
      setMembers(prev => prev.filter(m => m.email !== email));
    } catch (e) {
      alert("Failed to remove member.");
    }
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/onboarding?join=${businessId}&project=${projectId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ownerMember = members.find(m => m.role === "owner");
  const otherMembers = members.filter(m => m.role !== "owner");

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground font-lexend scrollbar-thin">
      {/* Sub-Header / Toolbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">Stakeholders & Crew</h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              Manage permissions for {localProjectName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-xl border border-border/50">
          <Users size={13} className="text-muted-foreground" />
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{members.length} Stakeholders</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12 space-y-10">
        {isOwner && (
          <section className="flex items-center gap-4 px-5 py-3 bg-primary/5 border border-primary/10 rounded-2xl shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ShieldCheck size={14} className="text-primary shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground shrink-0">Join Link:</p>
              <div className="px-3 h-8 flex-1 bg-card border border-primary/10 rounded-lg flex items-center text-[9px] font-mono text-muted-foreground truncate">
                {window.location.origin}/onboarding?join={businessId}&project={projectId}
              </div>
            </div>
            <button
              onClick={copyJoinLink}
              className="px-4 h-8 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {copied ? <><Check size={12} /> Copied</> : <><Link size={12} /> Copy Link</>}
            </button>
          </section>
        )}

        {!isOwner && !isLoading && (
          <div className="flex items-start gap-4 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black text-foreground uppercase tracking-wide">Read-only view</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Only the project owner can add or remove team members.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Team Members ({members.length})
          </h2>
          {isOwner && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <UserPlus size={14} /> Add stakeholder or crew
            </button>
          )}
        </div>

        <section className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/30 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground/30">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest">No team members yet</p>
            </div>
          ) : (
            <AnimatePresence>
              {ownerMember && (
                <motion.div
                  key={ownerMember.email}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Crown size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-foreground truncate">{ownerMember.email}</p>
                    <p className="text-[9px] text-amber-500/80 font-bold uppercase tracking-widest mt-0.5">Project Owner</p>
                  </div>
                  {ownerMember.email === currentUser?.email && (
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-amber-500/20">
                      You
                    </span>
                  )}
                </motion.div>
              )}

              {otherMembers.map((member, i) => {
                const roleInfo = ROLE_META[member.role] || ROLE_META.viewer;
                const isMe = member.email === currentUser?.email;
                return (
                  <motion.div
                    key={member.email}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex items-center gap-4 p-4 bg-card border border-border/60 rounded-2xl hover:border-border transition-all hover:bg-muted/20"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground text-sm font-black shrink-0">
                      {(member.email || "?").charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-foreground truncate">{member.email}</p>
                        {isMe && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider rounded-md">You</span>
                        )}
                      </div>
                      <div className={cn("flex items-center gap-1 mt-0.5 text-[9px] font-bold uppercase tracking-widest", roleInfo.color)}>
                        {roleInfo.icon}
                        <span>{roleInfo.label}</span>
                        <span className="text-muted-foreground/40 mx-1">·</span>
                        <span className="text-muted-foreground/60 normal-case font-medium tracking-normal text-[8px]">{roleInfo.description}</span>
                      </div>
                    </div>

                    {isOwner && !isMe && (
                      <button
                        onClick={() => handleRemove(member.email)}
                        className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                        title="Remove member"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </section>
      </main>

      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                      <UserPlus size={24} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Add Team Member</h2>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-60">Project Stakeholder or Crew</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsInviteModalOpen(false)}
                    className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email address</label>
                    <input
                      autoFocus
                      type="email"
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value.toLowerCase()); setInviteError(""); }}
                      placeholder="crew@example.com"
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                      className="w-full px-5 h-12 bg-muted/40 border border-border focus:border-primary/50 focus:bg-card rounded-2xl outline-none text-xs transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assign Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["admin", "editor", "viewer"] as MemberRole[]).map((role) => {
                        const meta = ROLE_META[role];
                        return (
                          <button
                            key={role}
                            onClick={() => setNewRole(role)}
                            className={cn(
                              "flex flex-col items-start gap-2 p-3 rounded-2xl border transition-all text-left",
                              newRole === role 
                                ? "bg-primary/5 border-primary/40" 
                                : "bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border"
                            )}
                          >
                            <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", newRole === role ? "text-primary" : "text-muted-foreground")}>
                              {meta.icon} {meta.label}
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-tight font-medium opacity-70">{meta.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-2xl flex items-center gap-3 text-destructive">
                      <AlertTriangle size={16} />
                      <p className="text-[10px] font-bold">{inviteError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleInvite}
                    disabled={isInviting || !newEmail.trim()}
                    className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isInviting
                      ? <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                      : <><UserPlus size={18} /> Invite Stakeholder</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamPage;
