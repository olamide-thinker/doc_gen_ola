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

// 3. Dynamic Connection Factory
const WS_URL = "ws://localhost:1235";

// We'll manage providers dynamically now
export let provider: HocuspocusProvider | null = null;
export let workspaceProvider: HocuspocusProvider | null = null;
export let authProvider: HocuspocusProvider | null = null;

export const connectWorkspace = (businessId: string, token: string) => {
  // Cleanup old ones if they exist
  if (workspaceProvider) workspaceProvider.destroy();
  if (authProvider) authProvider.destroy();

  workspaceProvider = new HocuspocusProvider({
    url: WS_URL,
    name: `business-workspace-${businessId}`,
    document: getYjsDoc(workspaceStore),
    token, // Send Firebase ID Token for backend auth
  });

  authProvider = new HocuspocusProvider({
    url: WS_URL,
    name: `business-auth-${businessId}`,
    document: getYjsDoc(authStore),
    token,
  });

  return { workspaceProvider, authProvider };
};

export const connectEditor = (docId: string, token: string) => {
  if (provider) provider.destroy();
  
  provider = new HocuspocusProvider({
    url: WS_URL,
    name: `doc-${docId}`,
    document: getYjsDoc(store),
    token,
  });

  return provider;
};

// Optional status logging
export const logStatus = (p: HocuspocusProvider) => {
  p.on('status', (event: any) => {
    console.log(`[Hocuspocus] Room ${p.configuration.name} status:`, event.status);
  });
};
