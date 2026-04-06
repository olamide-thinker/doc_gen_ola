import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-lexend">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-500/20">
          <ShieldAlert size={40} />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Access Revoked</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          The session owner has removed your access to this workspace. You are no longer authorized to view or edit these documents.
        </p>
        
        <div className="space-y-3">
          <button 
            onClick={() => window.location.href = 'https://google.com'}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Exit Workspace
          </button>
        </div>
        
        <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
          Security System Active
        </p>
      </motion.div>
    </div>
  );
};

export default AccessDenied;
