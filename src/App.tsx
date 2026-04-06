import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Editor from "./components/Editor";
import ReceiptEditor from "./components/ReceiptEditor";
import InvoicePreviewPage from "./components/InvoicePreviewPage";
import CrdtTest from "./components/CrdtTest";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/crdt-test" element={<CrdtTest />} />
      <Route path="/invoice-preview/:id" element={<InvoicePreviewPage />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/receipt-editor/:id" element={<ReceiptEditor />} />

      {/* 404 Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
