import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, UserX, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

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
  onBanClient: (email: string) => void;
  onMakeOwner: (email: string) => void;
  bannedClients: string[];
}

export const CollaboratorsSheet: React.FC<CollaboratorsSheetProps> = ({
  isOpen,
  onClose,
  collaborators,
  ownerId,
  onBanClient,
  onMakeOwner,
  bannedClients
}) => {
  const { user: currentUser, logout } = useAuth();

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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[380px] bg-white shadow-2xl z-[101] flex flex-col font-lexend"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Collaborators</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {collaborators.length} Active {collaborators.length === 1 ? "Session" : "Sessions"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {collaborators.map((col) => {
                const isMe = col.user.email === currentUser?.email;
                const isOwner = col.user.email === ownerId;
                const isBanned = col.user.email ? bannedClients.includes(col.user.email) : false;

                return (
                  <div key={col.id} className="flex items-center gap-4 group">
                    {/* Avatar */}
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0 border-2 border-white ring-1 ring-slate-100"
                      style={{ backgroundColor: col.user.color }}
                    >
                      {col.user.photo ? (
                        <img src={col.user.photo} alt={col.user.name} className="w-full h-full rounded-2xl object-cover" />
                      ) : (
                        col.user.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">
                          {col.user.name}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider">
                            Me
                          </span>
                        )}
                        {isOwner && (
                          <Shield size={12} className="text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{col.user.email || "Guest Session"}</p>
                    </div>

                    {/* Admin Actions */}
                    {currentUser?.email === ownerId && !isMe && col.user.email && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => onBanClient(col.user.email!)}
                          title="Ban User"
                          className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                        >
                          <UserX size={16} />
                        </button>
                        <button
                          onClick={() => onMakeOwner(col.user.email!)}
                          title="Transfer Ownership"
                          className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
               <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
               >
                 <LogOut size={14} />
                 Sign Out
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
