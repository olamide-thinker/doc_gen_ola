import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Editor from "./components/Editor";
import ReceiptEditor from "./components/ReceiptEditor";
import InvoicePreviewPage from "./components/InvoicePreviewPage";
import InvoiceManagementPage from "./components/InvoiceManagementPage";
import CrdtTest from "./components/CrdtTest";
import AccessDenied from "./components/AccessDenied";
import LoginPage from "./components/LoginPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import OnboardingPage from "./components/OnboardingPage";
import ProjectsPage from "./components/ProjectsPage";
import TeamPage from "./components/TeamPage";
import SettingsPage from "./components/SettingsPage";
import { PlanEditor } from "./components/PlanEditor";
// Unified task dashboard for all plans
import { TasksDashboard } from "./components/TasksDashboard";
import ExecutionPage from "./components/ExecutionPage";
import ReportsPage from "./components/ReportsPage";
import InventoryPage from "./components/InventoryPage";
import AccountingPage from "./components/AccountingPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, businessId, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!businessId) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, businessId, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (businessId) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

const BoardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, businessId, loading } = useAuth();
  const queryParams = new URLSearchParams(window.location.search);
  const isJoining = queryParams.has('join');

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (businessId && !isJoining) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

import MainLayout from "./components/MainLayout";

const AppContent: React.FC = () => {
  const { projectId: activeProjectId } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/denied" element={<AccessDenied />} />
      <Route path="/onboarding" element={<BoardingRoute><OnboardingPage /></BoardingRoute>} />
      
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={<Dashboard key={activeProjectId || 'initial'} />}
        />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="crdt-test" element={<CrdtTest />} />
        <Route path="tasks" element={<TasksDashboard />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="project/:id/execution" element={<ExecutionPage />} />
      </Route>

      <Route path="/invoice/:id" element={<ProtectedRoute><InvoiceManagementPage /></ProtectedRoute>} />
      <Route path="/invoice-preview/:id" element={<ProtectedRoute><InvoicePreviewPage /></ProtectedRoute>} />
      <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
      <Route path="/plan/:id" element={<ProtectedRoute><PlanEditor /></ProtectedRoute>} />
      <Route path="/receipt-editor/:id" element={<ProtectedRoute><ReceiptEditor /></ProtectedRoute>} />

      {/* 404 Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
