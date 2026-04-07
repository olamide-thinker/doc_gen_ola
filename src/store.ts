import { syncedStore, getYjsDoc } from "@syncedstore/core";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { DocData, WorkspaceProject } from "./types";

export { type WorkspaceProject };

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
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  members?: string[];
}

export interface WorkspaceDocument {
  id: string;
  name: string;
  content: any;
  folderId: string | null;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  invoiceId?: string | null;
  members?: string[];
}

export type WorkspaceState = {
  folders: WorkspaceFolder[];
  documents: WorkspaceDocument[];
  projects: WorkspaceProject[];
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
  documents: [] as WorkspaceDocument[],
  projects: [] as WorkspaceProject[]
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
  const workspaceRoom = `business-workspace-${businessId}`;
  const authRoom = `business-auth-${businessId}`;

  // Idempotency check: don't reconnect if already connected to same rooms with same token
  if (
    workspaceProvider && 
    workspaceProvider.configuration.name === workspaceRoom && 
    workspaceProvider.configuration.token === token &&
    authProvider &&
    authProvider.configuration.name === authRoom &&
    authProvider.configuration.token === token
  ) {
    return { workspaceProvider, authProvider };
  }

  // Cleanup old ones if they exist and are different
  if (workspaceProvider) workspaceProvider.destroy();
  if (authProvider) authProvider.destroy();

  workspaceProvider = new HocuspocusProvider({
    url: WS_URL,
    name: workspaceRoom,
    document: getYjsDoc(workspaceStore),
    token, // Send Firebase ID Token for backend auth
  });

  authProvider = new HocuspocusProvider({
    url: WS_URL,
    name: authRoom,
    document: getYjsDoc(authStore),
    token,
  });

  return { workspaceProvider, authProvider };
};

export const connectEditor = (docId: string, token: string) => {
  const roomName = `doc-${docId}`;

  if (
    provider && 
    provider.configuration.name === roomName && 
    provider.configuration.token === token
  ) {
    return provider;
  }

  if (provider) provider.destroy();
  
  provider = new HocuspocusProvider({
    url: WS_URL,
    name: roomName,
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
