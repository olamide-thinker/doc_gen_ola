import { syncedStore, getYjsDoc } from "@syncedstore/core";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { DocData } from "./types";

// 1. Define the shape of your Invoice/BOQ
export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceState = {
  customerName: string;
  items: InvoiceItem[];
  total: number;
};

// --- Workspace & Folder System ---
export interface WorkspaceFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocument {
  id: string;
  name: string;
  content: any;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  invoiceId?: string | null;
}

export type WorkspaceState = {
  folders: WorkspaceFolder[];
  documents: WorkspaceDocument[];
};

// --- Authorization & Governance ---
export type AuthState = {
  ownerId: string | null;
  bannedClients: string[];
};

// 2. Create the SyncedStores
export const store = syncedStore({ 
  items: [] as InvoiceItem[],
  metadata: {} as { customerName: string; total: number }
});

export const workspaceStore = syncedStore({ 
  folders: [] as WorkspaceFolder[], 
  documents: [] as WorkspaceDocument[] 
});

export const authStore = syncedStore({ 
  governance: {} as { ownerId: string | null },
  bannedClients: [] as string[] 
});

// 3. Connect to the Backend (Hocuspocus)
const WS_URL = "ws://localhost:1235";

// Main Invoice Provider (for the current file being edited)
export const provider = new HocuspocusProvider({
  url: WS_URL,
  name: "invoice-demo-123", 
  document: getYjsDoc(store),
});

// Workspace Provider (for the dashboard file tree)
export const workspaceProvider = new HocuspocusProvider({
  url: WS_URL,
  name: "global-workspace",
  document: getYjsDoc(workspaceStore),
});

// Auth Provider (for session management)
export const authProvider = new HocuspocusProvider({
  url: WS_URL,
  name: "session-auth",
  document: getYjsDoc(authStore),
});

provider.on('status', (event: any) => {
  console.log('[Hocuspocus] Connection status:', event.status);
});
