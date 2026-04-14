import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Users, ArrowRight, Check, ShieldCheck, Mail, X, Plus, LogOut, User as UserIcon } from '../lib/icons/lucide';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { API_BASE } from '../lib/workspace-persist';

const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinBusinessName, setJoinBusinessName] = useState<string | null>(null);
  
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(window.location.search);
  const joinId = queryParams.get('join');

  React.useEffect(() => {
    if (joinId) {
      const fetchJoinBusinessData = async () => {
        try {
          // We can call an unauthenticated or minimally authenticated API to get public name
          // For now, let's keep it simple or assume joinId is enough
          setJoinBusinessName("the workspace");
        } catch (e) {
          console.error(e);
        }
      };
      fetchJoinBusinessData();
    }
  }, [joinId]);

  const handleJoinBusiness = async () => {
    if (!joinId || !user) return;
    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/organizations/join/${joinId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to join organization');
      
      // If a project ID is in the URL, add the user to that specific project too.
      const projectId = queryParams.get('project');
      if (projectId && user.email) {
        try {
          await api.addMember('project', projectId, user.email);
          localStorage.setItem('invsys_active_project', projectId);
        } catch (e) {
          console.error('[Onboarding] Failed to auto-join project:', e);
        }
      }

      await refreshProfile();
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!businessName.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      
      // 1. Create Organization & Initial Project via NestJS API
      const response = await fetch(`${API_BASE}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: businessName })
      });

      if (!response.ok) throw new Error('Failed to create organization');
      
      const { organizationId } = await response.json();

      // 2. Sync user profile to Postgres
      await fetch(`${API_BASE}/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: organizationId,
          role: 'super-admin'
        })
      });

      setStep(2);
    } catch (error) {
      console.error('Error creating business:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMember = () => {
    if (!currentEmail.includes('@gmail.com')) {
      alert('Only Gmail addresses are allowed for members.');
      return;
    }
    if (currentEmail === user?.email) {
      alert('You are already the owner of this business.');
      return;
    }
    if (members.includes(currentEmail)) return;
    setMembers([...members, currentEmail]);
    setCurrentEmail('');
  };

  const removeMember = (email: string) => {
    setMembers(members.filter(m => m !== email));
  };

  const finalizeOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (projectName.trim()) {
        localStorage.setItem('invsys_initial_project', projectName.trim());
      }
      await refreshProfile();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error finalizing onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <nav className="fixed top-0 left-0 w-full h-20 px-8 flex items-center justify-between z-50 bg-background/50 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="text-sm font-black text-foreground tracking-tight uppercase">INV-SYS Pro</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Onboarding</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-2xl border border-border/50">
            <div className="w-8 h-8 bg-card rounded-lg flex items-center justify-center text-muted-foreground border border-border">
              <UserIcon size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-foreground tracking-tight line-clamp-1">{user?.displayName || 'User'}</span>
              <span className="text-[9px] text-muted-foreground font-medium line-clamp-1">{user?.email}</span>
            </div>
          </div>

          <button 
            onClick={() => logout()}
            className="flex items-center gap-2 group px-4 h-10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all font-bold text-[11px] uppercase tracking-wider"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </nav>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md pt-20">
        <div className="flex items-center justify-between mb-12">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-foreground tracking-tight">Onboarding</h1>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Step {step} of 3</p>
            </div>
            <div className="flex gap-2">
                <div className={cn("w-8 h-1 rounded-full transition-all", step >= 1 ? "bg-primary" : "bg-muted")} />
                <div className={cn("w-8 h-1 rounded-full transition-all", step >= 2 ? "bg-primary" : "bg-muted")} />
                <div className={cn("w-8 h-1 rounded-full transition-all", step >= 3 ? "bg-primary" : "bg-muted")} />
            </div>
        </div>

        <AnimatePresence mode="wait">
          {joinId ? (
            <motion.div 
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-3xl shadow-2xl p-8 border border-border/50 text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Users className="text-primary" size={32} />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Join Workspace</h2>
              <p className="text-sm text-muted-foreground mb-8">
                You've been invited to join <span className="text-foreground font-black font-lexend">{joinBusinessName || 'the workspace'}</span>.
              </p>
              
              <button 
                onClick={handleJoinBusiness}
                disabled={isSubmitting}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Accept Invitation <Check size={16} /></>
                )}
              </button>
              
              <button 
                onClick={() => navigate('/onboarding')}
                className="mt-6 text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Or create your own business
              </button>
            </motion.div>
          ) : step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-3xl shadow-2xl p-8 border border-border/50"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Briefcase className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">Create Business Account</h2>
              <p className="text-sm text-muted-foreground mb-8">Enter your business name to get started. You'll be the Super Admin.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Name</label>
                  <input 
                    type="text" 
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Tech Solutions"
                    className="w-full px-4 h-12 bg-muted/30 border border-border focus:border-primary/50 focus:bg-card rounded-xl outline-none text-sm transition-all font-medium"
                    autoFocus
                  />
                </div>
                
                <button 
                  onClick={handleCreateBusiness}
                  disabled={!businessName.trim() || isSubmitting}
                  className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Continue <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          ) : step === 2 ? (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-3xl shadow-2xl p-8 border border-border/50"
            >
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Users className="text-blue-500" size={24} />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">Invite Team Members</h2>
              <p className="text-sm text-muted-foreground mb-8">Add your colleagues to {businessName}. Only Gmail addresses are accepted.</p>
              
              <div className="space-y-6">
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <input 
                        type="email" 
                        value={currentEmail}
                        onChange={(e) => setCurrentEmail(e.target.value.toLowerCase())}
                        placeholder="colleague@gmail.com"
                        className="w-full pl-11 pr-4 h-12 bg-muted/30 border border-border focus:border-primary/50 focus:bg-card rounded-xl outline-none text-sm transition-all font-medium"
                      />
                   </div>
                   <button 
                    onClick={addMember}
                    className="px-4 bg-muted hover:bg-muted/80 rounded-xl transition-all border border-border"
                   >
                     <Plus size={20} />
                   </button>
                </div>

                <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
                   {members.map((email) => (
                     <div key={email} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl group hover:bg-muted/40 transition-colors border border-border/20">
                       <span className="text-xs font-semibold">{email}</span>
                       <button onClick={() => removeMember(email)} className="text-muted-foreground hover:text-destructive transition-colors">
                         <X size={14} />
                       </button>
                     </div>
                   ))}
                   {members.length === 0 && (
                     <div className="text-center py-6 border-2 border-dashed border-border/20 rounded-2xl">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest">No members added yet</p>
                     </div>
                   )}
                </div>
                
                <button 
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Next Step <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-card rounded-3xl shadow-2xl p-8 border border-border/50"
            >
              <div className="w-12 h-12 bg-lime-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Plus className="text-lime-600" size={24} />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">Launch Your First Project</h2>
              <p className="text-sm text-muted-foreground mb-8">Give your project a name to stay organized. You can always use the Playground.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Project Name</label>
                  <input 
                    type="text" 
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Pipeline Construction for NNPC"
                    className="w-full px-4 h-12 bg-muted/30 border border-border focus:border-primary/50 focus:bg-card rounded-xl outline-none text-sm transition-all font-medium"
                    autoFocus
                  />
                </div>
                
                <button 
                  onClick={finalizeOnboarding}
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>{projectName.trim() ? 'Create Project & Finish' : 'Skip & Start Playground'} <Check size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full">
                <ShieldCheck size={12} className="text-primary" />
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Secure Enterprise Mode</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
