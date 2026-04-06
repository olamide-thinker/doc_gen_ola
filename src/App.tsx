import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Editor from "./components/Editor";
import ReceiptEditor from "./components/ReceiptEditor";
import InvoicePreviewPage from "./components/InvoicePreviewPage";
import CrdtTest from "./components/CrdtTest";
import AccessDenied from "./components/AccessDenied";
import LoginPage from "./components/LoginPage";
import { AuthProvider, useAuth } from "./context/AuthContext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-900/10 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/denied" element={<AccessDenied />} />
        
        <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/crdt-test" element={<ProtectedRoute><CrdtTest /></ProtectedRoute>} />
        <Route path="/invoice-preview/:id" element={<ProtectedRoute><InvoicePreviewPage /></ProtectedRoute>} />
        <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/receipt-editor/:id" element={<ProtectedRoute><ReceiptEditor /></ProtectedRoute>} />

        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
