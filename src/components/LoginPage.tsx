import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, ShieldCheck, Zap, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Failed to sign in:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 font-lexend overflow-hidden relative transition-colors duration-300">
      {/* Background purely decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] bg-card rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-border p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center">
          {/* Logo / Brand Icon */}
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg mb-8 rotate-3">
             <Zap className="text-white fill-white" size={32} />
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight mb-3">
            Real-Time Workspace
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mb-10">
            Secure collaborative environment for professional document printing.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 gap-4 w-full mb-10 text-left">
             <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted border border-border/50">
               <div className="w-10 h-10 rounded-xl bg-card shadow-sm flex items-center justify-center text-primary shrink-0">
                 <ShieldCheck size={20} />
               </div>
               <div>
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-foreground/80">Governance</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Automatic session & owner protection</p>
               </div>
             </div>
             
             <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted border border-border/50">
               <div className="w-10 h-10 rounded-xl bg-card shadow-sm flex items-center justify-center text-blue-500 shrink-0">
                 <Globe size={20} />
               </div>
               <div>
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-foreground/80">Collaboration</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Synced identities via Google Auth</p>
               </div>
             </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full group relative flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-2xl py-4 font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] shadow-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-10 transition-opacity" />
            <LogIn size={20} className="group-hover:rotate-6 transition-transform" />
            Sign in with Google
          </button>

          <p className="mt-8 text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">
            Secured by Firebase Auth
          </p>
        </div>
      </motion.div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-10 left-0 w-full flex justify-center opacity-30">
         <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">INV-SYS Pro ● 2026</span>
      </div>
    </div>
  );
};

export default LoginPage;
