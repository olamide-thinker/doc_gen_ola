import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { API_BASE } from "../lib/workspace-persist";

interface AuthContextType {
  user: User | null;
  businessId: string | null;
  businessName: string | null;
  projectId: string | null;
  role: string | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProject: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(() => {
    return localStorage.getItem("invsys_active_project") || null;
  });
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setBusinessId(null);
        setProjectId(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE}/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const { data } = await response.json();
          setBusinessId(data?.businessId || null);
          setBusinessName(data?.businessName || null);
          setRole(data?.role || null);
          
          // Only set projectId if we don't already have one in localStorage
          if (!localStorage.getItem("invsys_active_project")) {
            const initialId = data?.projectId || 'playground';
            setProjectId(initialId);
            localStorage.setItem("invsys_active_project", initialId);
          }
        } else if (response.status === 404) {
          // User exists in Firebase but not in our Postgres yet
          // Handled by Onboarding
          setBusinessId(null);
          setProjectId(null);
        }
      } catch (e) {
        console.error("Auth profile fetch error:", e);
        setBusinessId(null);
        setProjectId(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle URL-based project switching
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlProject = params.get('project');
    if (urlProject && urlProject !== projectId) {
      console.log(`[Auth] 🔗 URL-based project detected: ${urlProject}. Syncing...`);
      setProject(urlProject);
    }
  }, [projectId]);

  const refreshProfile = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}/users/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const { data } = await response.json();
      setBusinessId(data?.businessId || null);
      setBusinessName(data?.businessName || null);
      setProjectId(data?.projectId || null);
      setRole(data?.role || null);
    }
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("invsys_active_project");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const setProject = (id: string) => {
    if (id === projectId) return;
    setProjectId(id);
    localStorage.setItem("invsys_active_project", id);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      businessId, 
      businessName,
      projectId, 
      role, 
      loading, 
      loginWithGoogle, 
      logout, 
      refreshProfile,
      setProject
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
