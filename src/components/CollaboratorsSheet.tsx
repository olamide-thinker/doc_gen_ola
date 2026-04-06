import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, UserX, UserPlus, LogOut, Plus, Link, Check, Briefcase, Users, ShieldCheck } from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Collaborator {
  id: string; // awareness clientId
  user: {
    name: string;
    email?: string;
    photo?: string;
    id?: string; // browserId or firebase uid
    color: string;
  };
}

interface CollaboratorsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: Collaborator[];
  ownerId: string | null;
  businessId: string | null;
  businessName: string;
  initialTab?: 'live' | 'team';
  onBanClient: (email: string) => void;
  onMakeOwner: (email: string) => void;
  bannedClients: string[];
}

export const CollaboratorsSheet: React.FC<CollaboratorsSheetProps> = ({
  isOpen,
  onClose,
  collaborators,
  ownerId,
  businessId,
  businessName,
  initialTab = 'live',
  onBanClient,
  onMakeOwner,
  bannedClients
}) => {
  const { user: currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'live' | 'team'>(initialTab);

  // Sync tab state when initialTab changes
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  const [members, setMembers] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch Team Members from Firestore
  useEffect(() => {
    if (isOpen && businessId && activeTab === 'team') {
      const fetchMembers = async () => {
        try {
          const bDoc = await getDoc(doc(db, "businesses", businessId));
          if (bDoc.exists()) {
            setMembers(bDoc.data().members || []);
          }
        } catch (error) {
          console.error("Error fetching members:", error);
        }
      };
      fetchMembers();
    }
  }, [isOpen, businessId, activeTab]);

  const handleAddMember = async () => {
    if (newEmail.includes("@gmail.com")) {
      if (newEmail === currentUser?.email) {
        alert("You are already the owner of this business.");
        return;
      }
    } else {
      alert("Only Gmail addresses are allowed.");
      return;
    }
    if (members.includes(newEmail)) return;
    
    setIsLoadingInvite(true);
    try {
      await updateDoc(doc(db, "businesses", businessId!), {
        members: arrayUnion(newEmail)
      });
      setMembers([...members, newEmail]);
      setNewEmail("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingInvite(false);
    }
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/onboarding?join=${businessId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = currentUser?.uid === ownerId;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/40 backdrop-blur-sm z-[100]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[400px] bg-card shadow-2xl z-[101] flex flex-col font-lexend border-l border-border/50"
          >
            {/* Header */}
            <div className="p-8 border-b border-border/30 bg-muted/20">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-foreground tracking-tight uppercase">INV-SYS Pro</h2>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Workspace Governance</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl hover:bg-muted text-muted-foreground transition-all border border-border/50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="flex p-1 bg-muted/40 rounded-2xl border border-border/30">
                <button 
                  onClick={() => setActiveTab('live')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                    activeTab === 'live' ? "bg-card text-foreground shadow-sm border border-border/30" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users size={14} className={activeTab === 'live' ? "text-primary" : ""} />
                  Live ({collaborators.length})
                </button>
                <button 
                  onClick={() => setActiveTab('team')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                    activeTab === 'team' ? "bg-card text-foreground shadow-sm border border-border/30" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Briefcase size={14} className={activeTab === 'team' ? "text-primary" : ""} />
                  Team
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin">
              {activeTab === 'live' ? (
                /* LIVE TAB */
                <div className="space-y-6">
                  {collaborators.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                       <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center">
                         <Users size={24} />
                       </div>
                       <p className="text-[11px] font-bold uppercase tracking-widest">No active sessions</p>
                    </div>
                  ) : (
                    collaborators.map((col) => {
                      const isMe = col.user.email === currentUser?.email;
                      const colIsOwner = col.user.id === ownerId;

                      return (
                        <div key={col.id} className="flex items-center gap-4 group">
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0 border-2 border-background ring-1 ring-border group-hover:scale-105 transition-transform overflow-hidden"
                            style={{ backgroundColor: col.user.color }}
                          >
                            {col.user.photo ? (
                              <img src={col.user.photo} alt={col.user.name} className="w-full h-full object-cover" />
                            ) : (
                              col.user.name.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">
                                {col.user.name}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider">
                                  Me
                                </span>
                              )}
                              {colIsOwner && (
                                <Shield size={12} className="text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{col.user.email || "Guest Session"}</p>
                          </div>

                          {isOwner && !isMe && col.user.email && (
                            <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                              <button
                                onClick={() => onBanClient(col.user.email!)}
                                className="p-2.5 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all border border-transparent hover:border-rose-500/20"
                              >
                                <UserX size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* TEAM TAB */
                <div className="space-y-10">
                  {/* Invite Member */}
                  {isOwner && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Invite New Specialist</label>
                      <div className="flex gap-3">
                        <input 
                          type="email" 
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value.toLowerCase())}
                          placeholder="e.g. expert@gmail.com"
                          className="flex-1 px-5 h-12 bg-muted/40 border border-border focus:border-primary/50 focus:bg-card rounded-2xl outline-none text-xs transition-all font-medium"
                        />
                        <button 
                          onClick={handleAddMember}
                          disabled={isLoadingInvite || !newEmail}
                          className="px-6 h-12 bg-primary text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
                        >
                          {isLoadingInvite ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Invite"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team Members List */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Core Team Members ({members.length})</label>
                    <div className="space-y-3">
                      {members.map(m => (
                        <div key={m} className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-2xl group hover:bg-muted/40 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground">
                              <Users size={14} />
                            </div>
                            <span className="text-xs font-bold text-foreground">{m}</span>
                          </div>
                          <div className="px-2.5 py-1 bg-muted/40 rounded-lg text-[8px] font-black uppercase tracking-wide text-muted-foreground border border-border/30 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all">Member</div>
                        </div>
                      ))}
                      {members.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic text-center py-4">No team members added yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Join Link */}
                  {isOwner && (
                    <div className="p-6 bg-primary/5 border border-primary/10 rounded-3xl space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                          <ShieldCheck className="text-primary" size={20} />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest leading-none">Shareable Access</h4>
                          <p className="text-[9px] text-muted-foreground font-medium mt-1.5">Direct onboarding link for your staff.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 px-4 h-11 bg-card border border-primary/10 rounded-xl flex items-center text-[10px] font-medium text-muted-foreground truncate opacity-70">
                          {window.location.origin}/onboarding?join={businessId}
                        </div>
                        <button 
                          onClick={copyJoinLink}
                          className="px-5 h-11 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          {copied ? "Copied" : <Check size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-border/30 bg-muted/10">
               <button
                onClick={() => logout()}
                className="w-full h-14 flex items-center justify-center gap-3 bg-card border border-border/50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm group"
               >
                 <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                 Secure Sign Out
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
