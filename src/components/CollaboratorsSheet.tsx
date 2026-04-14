import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, UserX, Users, UserPlus, Loader } from "../lib/icons/lucide";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

interface Collaborator {
  id: string;
  user: {
    name: string;
    email?: string;
    photo?: string;
    id?: string;
    color: string;
  };
  role?: string; // Persistent role from DB
}

interface CollaboratorsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: Collaborator[];
  ownerId: string | null;
  businessId: string | null;
  businessName: string;
  /** Not used — kept for backwards compat */
  initialTab?: 'live' | 'team';
  onBanClient: (email: string) => void;
  onMakeOwner?: (email: string) => void; // Optional now
  onUpdateRole?: (email: string, role: any) => void;
  onAddMember?: (email: string) => Promise<void>;
  availableEmails?: string[];
  bannedClients: string[];
}

export const CollaboratorsSheet: React.FC<CollaboratorsSheetProps> = ({
  isOpen,
  onClose,
  collaborators,
  ownerId,
  onBanClient,
  onUpdateRole,
  onAddMember,
  availableEmails = [],
  bannedClients,
}) => {
  const { user: currentUser } = useAuth();
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [isInviting, setIsInviting] = React.useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !onAddMember || isInviting) return;

    try {
      setIsInviting(true);
      await onAddMember(inviteEmail);
      setInviteEmail("");
    } catch (err: any) {
      alert(err.message || "Failed to add member.");
    } finally {
      setIsInviting(false);
    }
  };

  const isOwner = currentUser?.uid === ownerId;

  const roles = [
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
    { value: 'commenter', label: 'Commenter', description: 'Can add feedback' },
    { value: 'editor', label: 'Editor', description: 'Can edit content' }
  ];

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
            className="fixed right-0 top-0 h-full w-full max-w-[360px] bg-card shadow-2xl z-[101] flex flex-col font-lexend border-l border-border/50"
          >
            {/* Header */}
            <div className="p-6 border-b border-border/30 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-foreground tracking-tight uppercase flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    Live Sessions
                  </h2>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                    {collaborators.length} active {collaborators.length === 1 ? "session" : "sessions"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl hover:bg-muted text-muted-foreground transition-all border border-border/50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Invite Section (Owner only) */}
              {isOwner && onAddMember && (
                <div className="p-6 pb-2 border-b border-border/20">
                  <form onSubmit={handleInvite} className="space-y-3">
                    <div className="flex flex-col space-y-1">
                       <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
                         Invite Teammate
                       </label>
                       <div className="relative group">
                         <select
                           value={inviteEmail}
                           onChange={(e) => setInviteEmail(e.target.value)}
                           className="w-full bg-muted/20 border border-border/50 rounded-2xl h-12 pl-4 pr-12 text-[11px] font-bold uppercase tracking-tight focus:outline-none focus:ring-1 focus:ring-primary/20 focus:bg-muted/30 transition-all appearance-none text-foreground"
                         >
                           <option value="" className="bg-card text-muted-foreground">Select a teammate...</option>
                           {availableEmails.map(email => (
                             <option key={email} value={email} className="bg-card text-foreground">
                               {email}
                             </option>
                           ))}
                         </select>
                         <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                            <Users size={12} />
                         </div>
                         <button
                           type="submit"
                           disabled={!inviteEmail || isInviting}
                           className={cn(
                             "absolute right-1.5 top-1.5 w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                             inviteEmail 
                               ? "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95" 
                               : "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                           )}
                         >
                           {isInviting ? (
                             <Loader size={16} className="animate-spin" />
                           ) : (
                             <UserPlus size={16} />
                           )}
                         </button>
                       </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Collaborator list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {collaborators.length === 0 ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center">
                      <Users size={24} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest">No active sessions</p>
                    <p className="text-[9px] text-muted-foreground">When teammates open this workspace, they'll appear here in real time.</p>
                  </div>
                ) : (
                collaborators.map((col) => {
                  const isMe = col.user.email === currentUser?.email;
                  const colIsOwner = col.user.id === ownerId || col.role === 'owner';
                  const displayRole = col.role || (colIsOwner ? 'owner' : 'editor');

                  return (
                    <div key={col.id} className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/40 group hover:bg-muted/40 transition-all">
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 overflow-hidden border-2 border-background ring-1 ring-border"
                          style={{ backgroundColor: col.user.color }}
                        >
                          {col.user.photo ? (
                            <img src={col.user.photo} alt={col.user.name} className="w-full h-full object-cover" />
                          ) : (
                            (col.user.name || "?").charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-foreground truncate">{col.user.name}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider">
                                Me
                              </span>
                            )}
                            {colIsOwner && (
                              <Shield size={11} className="text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[9px] text-muted-foreground truncate">{col.user.email || "Guest"}</p>
                            <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/30">•</span>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full",
                              displayRole === 'owner' ? "bg-amber-500/10 text-amber-600" :
                              displayRole === 'editor' ? "bg-blue-500/10 text-blue-600" :
                              "bg-slate-500/10 text-slate-600"
                            )}>
                              {displayRole}
                            </span>
                          </div>
                        </div>

                        {/* Actions (owner only, not self) */}
                        {isOwner && !isMe && col.user.email && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                             <button
                                onClick={() => onBanClient(col.user.email!)}
                                className={cn(
                                  "p-2 rounded-xl transition-all border border-transparent",
                                  bannedClients.includes(col.user.email!)
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : "hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 hover:border-rose-500/20"
                                )}
                                title="Remove session"
                              >
                                <UserX size={14} />
                              </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Role Management (Owner only) */}
                      {isOwner && !isMe && col.user.email && !colIsOwner && onUpdateRole && (
                        <div className="flex bg-muted/10 rounded-xl p-1 gap-1 border border-border/20 mx-1">
                          {roles.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => onUpdateRole(col.user.email!, r.value)}
                              className={cn(
                                "flex-1 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all",
                                displayRole === r.value 
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                                  : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-background/50"
                              )}
                              title={r.description}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

