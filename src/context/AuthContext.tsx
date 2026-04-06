import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  businessId: string | null;
  role: string | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        if (currentUser) {
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("../lib/firebase");
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setBusinessId(userDoc.data().businessId);
            setRole(userDoc.data().role);
          } else {
            setBusinessId(null);
            setRole(null);
          }
        } else {
          setBusinessId(null);
          setRole(null);
        }
      } catch (e) {
        console.error("Auth metadata fetch error:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const refreshBusiness = async () => {
    if (!user) return;
    const { getFirestore, doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../lib/firebase");
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      setBusinessId(userDoc.data().businessId);
      setRole(userDoc.data().role);
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
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, businessId, role, loading, loginWithGoogle, logout, refreshBusiness }}>
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
