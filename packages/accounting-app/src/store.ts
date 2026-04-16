import { syncedStore, getYjsDoc } from "@syncedstore/core";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { DocData, WorkspaceProject, DocumentMember, MemberRole } from "./types";

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
  businessId?: string;
  members?: DocumentMember[];
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  isOwner?: boolean;
}

export interface WorkspaceDocument {
  id: string;
  userId?: string; // Owner UID
  name: string;
  content: any;
  folderId: string | null;
  projectId?: string;
  businessId?: string;
  createdAt: string;
  updatedAt: string;
  invoiceId?: string | null;
  members?: DocumentMember[];
  metadata?: any;
  isOwner?: boolean;
  status?: string;
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

export const uiStore = syncedStore({
  settings: {} as {
    searchQuery: string;
    viewMode: "grid" | "list";
    isStreamOpen: boolean;
  }
});

// Initialize defaults
uiStore.settings.searchQuery = "";
uiStore.settings.viewMode = "grid";
uiStore.settings.isStreamOpen = false;

// ---------------------------------------------------------------------------
// Editor-level collaborative store
// ---------------------------------------------------------------------------
// One shared SyncedStore that backs the Editor / ReceiptEditor. Each invoice
// (or receipt) gets its own Hocuspocus room (`doc-{id}`), and this store is
// bound to that room by `connectEditor` below. All components should read
// `editorStore.content` via `useSyncedStore` — mutations propagate to every
// connected peer automatically via Yjs.
//
// The shape is intentionally loose (`any`) because DocData is a deep,
// heterogeneous JSON object and SyncedStore will proxy every key we touch.
export const editorStore = syncedStore({
  content: {} as any,
});

// 3. Dynamic Connection Factory
const WS_URL = "ws://localhost:1235";

// We'll manage providers dynamically now
export let provider: HocuspocusProvider | null = null;
export let workspaceProvider: HocuspocusProvider | null = null;
export let authProvider: HocuspocusProvider | null = null;

/**
 * The businessId of the currently connected workspace.
 * Set by connectWorkspace() and used by api.ts as a key for all persistence calls.
 * Null means no workspace is connected (user not yet authenticated).
 */
export let currentProjectId: string | null = null;
export let currentBusinessId: string | null = null;
export let currentDocId: string | null = null;

/**
 * Returns a fresh Firebase ID token.
 * Hocuspocus calls this on every reconnect / auth challenge,
 * so the backend always gets a non-expired token.
 */
async function getFreshToken(): Promise<string> {
  const { auth } = await import('./lib/firebase');
  const user = auth.currentUser;
  if (!user) {
    console.warn('[Hocuspocus Auth] ❌ No user found in auth, cannot get token');
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken(true);
  
  // LOGGING FOR DEBUGGING "ZOMBIE" TOKENS
  const payload = JSON.parse(atob(token.split('.')[1]));
  const exp = new Date(payload.exp * 1000).toLocaleString();
  console.log(`[Hocuspocus Auth] 🔑 Fresh token requested at ${new Date().toLocaleString()}. Expires at: ${exp}`);
  
  return token;
}

export const connectProject = (projectId: string, token: string, businessId?: string) => {
  currentProjectId = projectId;
  currentBusinessId = businessId || null;
  const projectRoom = `project-${projectId}`;
  const authRoom = `project-auth-${projectId}`;

  // Idempotency check: don't reconnect if already connected to same rooms
  if (
    workspaceProvider &&
    workspaceProvider.configuration.name === projectRoom &&
    authProvider &&
    authProvider.configuration.name === authRoom
  ) {
    return { workspaceProvider, authProvider };
  }

  // FORCE CLEAR LOCAL STATE: Wipe folders, documents, and projects before connecting new provider
  // This prevents the user from seeing old project data while the new one is loading.
  workspaceStore.folders.splice(0, workspaceStore.folders.length);
  workspaceStore.documents.splice(0, workspaceStore.documents.length);
  workspaceStore.projects.splice(0, workspaceStore.projects.length);

  // Cleanup old ones if they exist and are different
  if (workspaceProvider) workspaceProvider.destroy();
  if (authProvider) authProvider.destroy();

  workspaceProvider = new HocuspocusProvider({
    url: WS_URL,
    name: projectRoom,
    document: getYjsDoc(workspaceStore),
    token: getFreshToken, // dynamic token function — refreshed on every reconnect
    // maxAttempts: 10,       // stop retrying after 10 failed attempts
  });

  authProvider = new HocuspocusProvider({
    url: WS_URL,
    name: authRoom,
    document: getYjsDoc(authStore),
    token: getFreshToken,
    // maxAttempts: 10,
  });

  return { workspaceProvider, authProvider };
};

/**
 * Connect the editor-level SyncedStore (`editorStore`) to the Hocuspocus
 * room for a specific document. Every client that connects to the same
 * `doc-{docId}` room shares the exact same `editorStore.content` — that's
 * what makes real-time collaborative editing work.
 *
 * Call this from Editor.tsx / ReceiptEditor.tsx right after `connectProject`.
 */
export const connectEditor = (docId: string, token: string) => {
  const roomName = `doc-${docId}`;

  if (provider && provider.configuration.name === roomName) {
    return provider;
  }

  // Switching documents: wipe the proxy content BEFORE connecting the new
  // provider so stale fields from the previous doc don't leak into this one.
  // When the server has existing content, it'll sync it back almost
  // immediately via the `synced` event.
  const contentKeys = Object.keys(editorStore.content || {});
  for (const k of contentKeys) {
    delete (editorStore.content as any)[k];
  }
  currentDocId = docId;

  if (provider) provider.destroy();

  provider = new HocuspocusProvider({
    url: WS_URL,
    name: roomName,
    document: getYjsDoc(editorStore),
    token: getFreshToken,
  });

  return provider;
};

// Optional status logging
export const logStatus = (p: HocuspocusProvider) => {
  p.on('status', (event: any) => {
    console.log(`[Hocuspocus] Room ${p.configuration.name} status:`, event.status);
  });
};
