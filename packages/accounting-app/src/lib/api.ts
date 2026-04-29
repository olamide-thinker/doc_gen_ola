import { workspaceStore, currentBusinessId, currentProjectId, type WorkspaceFolder, type WorkspaceDocument, type WorkspaceProject } from "../store";
import { 
  type DocData, 
  type InvoiceCode, 
  type DocumentMember,
  type MemberRole
} from "../types";
import { type TemplateDefinition, TEMPLATES } from "./templates";
import { workspacePersist, authHeaders, API_BASE } from "./workspace-persist";

// Helper to save to local storage (for templates only)
const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(`invsys_${key}`, JSON.stringify(data));
};

const getFromStorage = (key: string, fallback: any) => {
  let data = localStorage.getItem(`invsys_${key}`);
  if (!data) {
    data = localStorage.getItem(`shan_${key}`);
    if (data) localStorage.setItem(`invsys_${key}`, data);
  }
  return data ? JSON.parse(data) : fallback;
};

export const getPlaygroundId = (uid?: string) => uid ? `playground-${uid}` : 'playground';
export const isPlayground = (id: string | null) => id === 'playground' || id?.startsWith('playground-');

// Helper to get a stable persistence room even if none is active
const getPersistenceContext = (uid?: string) => {
  if (currentProjectId && currentProjectId !== 'undefined' && currentProjectId !== 'null') {
    return currentProjectId;
  }
  return getPlaygroundId(uid);
};

/**
 * initializeWorkspace — call this AFTER Hocuspocus has synced, not at import time.
 */
export const initializeWorkspace = (userEmail: string, userId: string) => {
  // Already has data — nothing to do
  if (workspaceStore.projects.length > 0) return;

  const initialProjectName = localStorage.getItem('invsys_initial_project');
  if (initialProjectName) {
    const newProj: WorkspaceProject = {
      id: crypto.randomUUID(),
      name: initialProjectName,
      createdAt: new Date().toISOString(),
      members: [{ email: userEmail, role: 'editor' }]
    };
    workspaceStore.projects.push(newProj);
    if (currentProjectId) workspacePersist.upsertProject(currentProjectId, newProj);
    localStorage.removeItem('invsys_initial_project');
  }

  const playgroundId = `playground-${userId}`;
  const playground: WorkspaceProject = {
    id: playgroundId,
    name: "Playground",
    createdAt: new Date().toISOString(),
    members: [{ email: userEmail, role: 'editor' }]
  };
  workspaceStore.projects.push(playground);
  if (currentProjectId) workspacePersist.upsertProject(currentProjectId, playground);

  // Migrate any legacy folders/documents from localStorage
  const folders = getFromStorage("folders", []);
  const documents = getFromStorage("documents", []);

  if (folders.length > 0) {
    const migrated = folders.map((f: any) => ({ ...f, projectId: f.projectId || playgroundId }));
    workspaceStore.folders.push(...migrated);
    migrated.forEach((f: WorkspaceFolder) => {
      if (currentProjectId) workspacePersist.upsertFolder(currentProjectId, f);
    });
  }

  if (documents.length > 0) {
    const migrated = documents.map((d: any) => ({ ...d, projectId: d.projectId || playgroundId }));
    workspaceStore.documents.push(...migrated);
    migrated.forEach((d: WorkspaceDocument) => {
      if (currentProjectId) workspacePersist.upsertDocument(currentProjectId, d as WorkspaceDocument);
    });
  }
};

/** Check if a user is a member of a specific project (project-level access grants full visibility) */
function isUserProjectMember(projectId: string, email: string): boolean {
  return workspaceStore.projects.some(
    p => p.id === projectId && (p.members || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email)
  );
}

/** Check if user can access an item — project members see everything, otherwise per-item membership */
function canAccess(email: string, projectId: string | undefined, itemMembers: any[] | undefined): boolean {
  if (projectId && isUserProjectMember(projectId, email)) return true;
  return (itemMembers || []).some((m: any) => (typeof m === 'string' ? m : m.email) === email);
}

export const api = {
  // --- Folders ---
  getFolders: async (projectId: string): Promise<WorkspaceFolder[]> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/workspace/${projectId}/folders`, { headers });
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.error('[API] getFolders failed:', e);
      return [];
    }
  },

  getFolder: async (projectId: string, folderId: string): Promise<WorkspaceFolder | null> => {
     try {
       const folders = await api.getFolders(projectId);
       return folders.find(f => f.id === folderId) || null;
     } catch (e) {
       return null;
     }
  },

  getFolderPath: async (projectId: string, id: string | null): Promise<WorkspaceFolder[]> => {
    if (!id) return [];
    try {
      const allFolders = await api.getFolders(projectId);
      const path: WorkspaceFolder[] = [];
      let currentId: string | null = id;

      while (currentId) {
        const folder = allFolders.find(f => f.id === currentId);
        if (folder) {
          path.unshift(folder);
          currentId = folder.parentId || (folder.metadata as any)?.parentId || null;
        } else {
          currentId = null;
        }
      }
      return path;
    } catch (e) {
      return [];
    }
  },

  createFolder: async (name: string, projectId: string, userEmail: string, parentId: string | null = null): Promise<WorkspaceFolder> => {
    const newFolder: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      projectId,
      businessId: currentBusinessId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [{ email: userEmail, role: 'editor' }]
    };
    
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workspace/${projectId}/folders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newFolder)
    });
    
    if (!res.ok) throw new Error('Failed to create folder');
    return newFolder;
  },

  renameFolder: async (id: string, name: string): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    let folder = folders.find(f => f.id === id);
    if (!folder && currentProjectId) {
      const all = await api.getFolders(currentProjectId);
      const found = all.find(f => f.id === id);
      if (found) {
        folders.push(found);
        folder = folders[folders.length - 1];
      }
    }

    if (!folder) throw new Error("Folder not found");
    folder.name = name;
    folder.updatedAt = new Date().toISOString();
    if (currentProjectId) workspacePersist.upsertFolder(currentProjectId, folder as WorkspaceFolder);
    return folder as WorkspaceFolder;
  },

  deleteFolder: async (projectId: string, id: string): Promise<void> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workspace/${projectId}/folders/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete folder');
  },

  moveFolder: async (id: string, newParentId: string | null): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    let folder = folders.find(f => f.id === id);
    if (!folder && currentProjectId) {
      const all = await api.getFolders(currentProjectId);
      const found = all.find(f => f.id === id);
      if (found) {
        folders.push(found);
        folder = folders[folders.length - 1];
      }
    }

    if (!folder) throw new Error("Folder not found");
    folder.parentId = newParentId;
    folder.updatedAt = new Date().toISOString();
    if (currentProjectId) workspacePersist.upsertFolder(currentProjectId, folder as WorkspaceFolder);
    return folder as WorkspaceFolder;
  },

  duplicateFolderToFolder: async (id: string, targetParentId: string | null, userEmail: string): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    let original = folders.find(f => f.id === id);
    if (!original && currentProjectId) {
      const all = await api.getFolders(currentProjectId);
      original = all.find(f => f.id === id);
      if (original) {
        folders.push(original);
        original = folders[folders.length - 1];
      }
    }
    if (!original) throw new Error("Folder not found");

    const newFolderId = crypto.randomUUID();
    const newFolder: WorkspaceFolder = {
      ...original,
      id: newFolderId,
      name: `${original.name} (Copy)`,
      parentId: targetParentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [{ email: userEmail, role: 'editor' }]
    };
    folders.push(newFolder);
    if (currentProjectId) workspacePersist.upsertFolder(currentProjectId, newFolder);

    // Duplicate documents in folder
    workspaceStore.documents.filter(d => d.folderId === id).forEach(d => {
      api.createDocument(d.name, d.content, d.projectId || "playground", userEmail, newFolderId);
    });

    return newFolder;
  },

  // --- Documents ---
  getDocuments: async (projectId: string | null): Promise<WorkspaceDocument[]> => {
    if (!projectId) return [];
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/workspace/${projectId}/documents`, { headers });
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.error('[API] getDocuments failed:', e);
      return [];
    }
  },

  getDocument: async (id: string): Promise<WorkspaceDocument | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/workspace/documents/${id}`, { headers });
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.error('[API] getDocument failed:', e);
      return null;
    }
  },

  createDocument: async (name: string, content: any, projectId: string, userEmail: string, folderId: string | null = null): Promise<WorkspaceDocument> => {
    const newDoc: WorkspaceDocument = {
      id: crypto.randomUUID(),
      name,
      content,
      folderId,
      projectId,
      businessId: currentBusinessId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [{ email: userEmail, role: 'editor' }]
    };

    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workspace/${projectId}/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newDoc)
    });
    
    if (!res.ok) throw new Error('Failed to create document');
    return newDoc;
  },

  updateDocument: async (id: string, content: any, metadata?: any): Promise<WorkspaceDocument> => {
    // Find the doc in the local Yjs store (optimistic view)
    const docs = workspaceStore.documents;
    const index = docs.findIndex(d => d.id === id);
    let existing: WorkspaceDocument | undefined;
    if (index !== -1) {
      if (content) docs[index].content = content;
      if (metadata) docs[index].metadata = metadata;
      docs[index].updatedAt = new Date().toISOString();
      existing = docs[index] as unknown as WorkspaceDocument;
    }

    // Resolve the project to PATCH against — REST is the source of truth now.
    const projectId = existing?.projectId || currentProjectId;
    if (!projectId) {
      console.warn('[API] updateDocument: no projectId, skipping REST persist');
      return existing as WorkspaceDocument;
    }

    // If the doc isn't in our local store yet, fetch it from REST so we can
    // build a valid upsert payload (name, folderId, members, etc.).
    if (!existing) {
      try {
        const all = await api.getDocuments(projectId);
        const found = all.find(d => d.id === id);
        if (found) existing = { ...found, content, updatedAt: new Date().toISOString() };
      } catch (e) {
        console.error('[API] updateDocument: failed to fetch existing doc', e);
      }
    }

    if (!existing) throw new Error('Document not found');

    // Upsert via REST — the backend's POST handler does an onConflictDoUpdate.
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/workspace/${projectId}/documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id,
          name: existing.name,
          content,
          folderId: existing.folderId ?? null,
          projectId,
          businessId: existing.businessId,
          invoiceId: (existing as any).invoiceId ?? null,
          members: existing.members || [],
          metadata: metadata || existing.metadata || {},
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[API] updateDocument REST failed:', err);
      }
    } catch (e) {
      console.error('[API] updateDocument REST error:', e);
    }

    return existing;
  },

  renameDocument: async (id: string, name: string): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    let doc = docs.find(d => d.id === id);
    if (!doc && currentProjectId) {
      const all = await api.getDocuments(currentProjectId);
      const found = all.find(d => d.id === id);
      if (found) {
        docs.push(found);
        doc = docs[docs.length - 1];
      }
    }

    if (!doc) throw new Error("Document not found");
    doc.name = name;
    doc.updatedAt = new Date().toISOString();
    if (currentProjectId) workspacePersist.upsertDocument(currentProjectId, doc as unknown as WorkspaceDocument);
    return doc as unknown as WorkspaceDocument;
  },

  deleteDocument: async (projectId: string, id: string): Promise<void> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workspace/${projectId}/documents/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  moveDocument: async (id: string, newFolderId: string | null): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    let doc = docs.find(d => d.id === id);
    if (!doc && currentProjectId) {
      const all = await api.getDocuments(currentProjectId);
      const found = all.find(d => d.id === id);
      if (found) {
        docs.push(found);
        doc = docs[docs.length - 1];
      }
    }

    if (!doc) throw new Error("Document not found");
    doc.folderId = newFolderId;
    doc.updatedAt = new Date().toISOString();
    if (currentProjectId) workspacePersist.upsertDocument(currentProjectId, doc as unknown as WorkspaceDocument);
    return doc as unknown as WorkspaceDocument;
  },

  duplicateDocumentToFolder: async (id: string, targetFolderId: string | null, userEmail: string): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    let original = docs.find(d => d.id === id);
    if (!original && currentProjectId) {
      const all = await api.getDocuments(currentProjectId);
      original = all.find(d => d.id === id);
      if (original) {
        docs.push(original);
        original = docs[docs.length - 1];
      }
    }
    if (!original) throw new Error("Document not found");
    return api.createDocument(`${original.name} (Copy)`, original.content, original.projectId || "playground", userEmail, targetFolderId);
  },

  // --- Templates ---
  getTemplates: async (): Promise<TemplateDefinition[]> => {
    return getFromStorage("templates", TEMPLATES);
  },

  updateTemplate: async (id: string, updates: Partial<TemplateDefinition>): Promise<TemplateDefinition> => {
    const templates = await api.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Template not found");
    templates[index] = { ...templates[index], ...updates };
    saveToStorage("templates", templates);
    return templates[index];
  },

  deleteTemplate: async (id: string): Promise<void> => {
    const templates = await api.getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    saveToStorage("templates", filtered);
  },

  // --- Counters ---
  getNextReceiptNumber: (): string => {
    const counter = Number(localStorage.getItem("invsys_receipt_counter") || "0") + 1;
    localStorage.setItem("invsys_receipt_counter", String(counter));
    return `REC/IP/${String(counter).padStart(4, "0")}/${new Date().getFullYear()}`;
  },

  peekNextInvoiceNumber: (): string => {
    const counter = Number(localStorage.getItem("invsys_invoice_counter") || "0") + 1;
    return `INV/IP/${String(counter).padStart(4, "0")}/${new Date().getFullYear()}`;
  },

  getNextInvoiceNumber: (): InvoiceCode => {
    const counter = Number(localStorage.getItem("invsys_invoice_counter") || "0") + 1;
    localStorage.setItem("invsys_invoice_counter", String(counter));
    const year = new Date().getFullYear();
    const count = String(counter).padStart(4, "0");
    return { text: `INV/IP/${count}/${year}`, prefix: "INV", count, year: String(year), x: 600, y: 100, color: "#503D36" };
  },

  // --- Search ---
  searchAll: async (query: string, userEmail: string): Promise<WorkspaceDocument[]> => {
    if (!query.trim()) return [];
    const documents = workspaceStore.documents;
    const q = query.toLowerCase().trim();
    return documents.filter((d) =>
      canAccess(userEmail, d.projectId, d.members) && (
        d.name.toLowerCase().includes(q) ||
        (d.content?.invoiceCode?.text || "").toLowerCase().includes(q) ||
        (d.content?.contact?.name || "").toLowerCase().includes(q)
      )
    ) as unknown as WorkspaceDocument[];
  },

  // --- Projects ---
  getProjects: async (): Promise<WorkspaceProject[]> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/workspace/projects`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        // Hydrate local store with REST data as a fallback/cache
        workspaceStore.projects.splice(0, workspaceStore.projects.length, ...json.data);
        return json.data;
      }
      return [];
    } catch (error) {
      console.warn('[API] Failed to fetch projects via REST:', error);
      return [];
    }
  },

  createProject: async (name: string, userEmail: string): Promise<WorkspaceProject> => {
    const newProj: WorkspaceProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      members: [{ email: userEmail, role: 'editor' }]
    };
    const currentUser = (await import('./firebase')).auth.currentUser;
    const contextId = getPersistenceContext(currentUser?.uid);
    workspaceStore.projects.push(newProj);
    workspacePersist.upsertProject(contextId, newProj);
    return newProj;
  },

  deleteProject: async (id: string): Promise<void> => {
    const idx = workspaceStore.projects.findIndex(p => p.id === id);
    if (idx !== -1) workspaceStore.projects.splice(idx, 1);
    if (currentProjectId) workspacePersist.deleteProject(currentProjectId, id);
  },

  // --- Permissions ---
  addMember: async (type: 'project' | 'folder' | 'document', id: string, email: string, role: MemberRole = 'editor'): Promise<DocumentMember[]> => {
    if (!currentProjectId && type !== 'project') {
      throw new Error('No active project');
    }

    const normalize = (members: any[]): DocumentMember[] => {
      return (members || []).map(m => typeof m === 'string' ? { email: m, role: 'editor' } : m);
    };

    // 1. Compute the new member list
    let currentMembers: DocumentMember[] = [];
    if (type === 'project') {
      const p = workspaceStore.projects.find(p => p.id === id);
      currentMembers = normalize([...(p?.members || [])]);
    } else if (type === 'folder') {
      const f = workspaceStore.folders.find(f => f.id === id);
      currentMembers = normalize([...(f?.members || [])]);
      if (currentMembers.length === 0) {
        const folders = await api.getFolders(currentProjectId!);
        currentMembers = normalize([...(folders.find(x => x.id === id)?.members || [])]);
      }
    } else {
      const d = workspaceStore.documents.find(d => d.id === id);
      currentMembers = normalize([...(d?.members || [])]);
      if (currentMembers.length === 0) {
        const docs = await api.getDocuments(currentProjectId!);
        currentMembers = normalize([...(docs.find(x => x.id === id)?.members || [])]);
      }
    }
    
    if (!currentMembers.find(m => m.email === email)) {
      currentMembers.push({ email, role });
    }

    // 2. Local Yjs update
    if (type === 'project') {
      const p = workspaceStore.projects.find(p => p.id === id);
      if (p) { p.members = currentMembers; }
    } else if (type === 'folder') {
      const f = workspaceStore.folders.find(f => f.id === id);
      if (f) { f.members = currentMembers; }
    } else {
      const d = workspaceStore.documents.find(d => d.id === id);
      if (d) { d.members = currentMembers; }
    }

    // 3. Persist
    const headers = await authHeaders();
    if (type === 'project') {
      const res = await fetch(`${API_BASE}/projects/${id}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add project member');
      }
    } else {
      const res = await fetch(
        `${API_BASE}/workspace/${currentProjectId}/${type}s/${id}/members`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ members: currentMembers.map(m => m.email) }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update members');
      }
    }

    return currentMembers;
  },

  removeMember: async (type: 'project' | 'folder' | 'document', id: string, email: string): Promise<DocumentMember[]> => {
    let currentMembers: DocumentMember[] = [];
    const normalize = (members: any[]): DocumentMember[] => {
      return (members || []).map(m => typeof m === 'string' ? { email: m, role: 'editor' } : m);
    };

    if (type === 'project') {
      const p = workspaceStore.projects.find(p => p.id === id);
      p!.members = normalize(p!.members || []).filter(m => m.email !== email);
      currentMembers = p!.members;
    } else if (type === 'folder') {
      const f = workspaceStore.folders.find(f => f.id === id);
      f!.members = normalize(f!.members || []).filter(m => m.email !== email);
      currentMembers = f!.members;
    } else {
      const d = workspaceStore.documents.find(d => d.id === id);
      d!.members = normalize(d!.members || []).filter(m => m.email !== email);
      currentMembers = d!.members;
    }

    const headers = await authHeaders();
    if (type === 'project') {
      await fetch(`${API_BASE}/projects/${id}/members/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers
      });
    } else {
      await fetch(`${API_BASE}/workspace/${currentProjectId}/${type}s/${id}/members`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ members: currentMembers.map(m => m.email) })
      });
    }

    return currentMembers;
  },

  updateMemberRole: async (type: 'project' | 'folder' | 'document', id: string, email: string, role: MemberRole): Promise<DocumentMember[]> => {
    let updatedMembers: DocumentMember[] = [];
    const normalize = (members: any[]): DocumentMember[] => {
      return (members || []).map(m => typeof m === 'string' ? { email: m, role: 'editor' } : m);
    };

    const applyUpdate = (members: any[]) => {
      const normalized = normalize(members);
      return normalized.map(m => m.email === email ? { ...m, role } : m);
    };

    if (type === 'project') {
      const p = workspaceStore.projects.find(p => p.id === id);
      if (p) { p.members = applyUpdate(p.members || []); updatedMembers = p.members; }
    } else if (type === 'folder') {
      const f = workspaceStore.folders.find(f => f.id === id);
      if (f) { f.members = applyUpdate(f.members || []); updatedMembers = f.members; }
    } else {
      const d = workspaceStore.documents.find(d => d.id === id);
      if (d) { d.members = applyUpdate(d.members || []); updatedMembers = d.members; }
    }

    const headers = await authHeaders();
    if (type === 'project') {
      const res = await fetch(
        `${API_BASE}/projects/${id}/members/${encodeURIComponent(email)}/role`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update member role');
      }
    } else {
      await fetch(`${API_BASE}/workspace/${currentProjectId}/${type}s/${id}/members`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ members: updatedMembers.map(m => m.email) }),
      });
    }

    return updatedMembers;
  },

  reorderItems: async (folderId: string | null, activeId: string, overId: string): Promise<void> => {
    // Local move is handled by UI/Store, but we can finalize here if needed
    // For now, this just satisfies the interface used in Dashboard.tsx
    console.log(`Reordering ${activeId} over ${overId} in folder ${folderId}`);
  },

  togglePinTemplate: async (templateId: string): Promise<void> => {
    const templates = await api.getTemplates();
    const t = templates.find(t => t.id === templateId);
    if (t) {
      await api.updateTemplate(templateId, { isPinned: !t.isPinned });
    }
  },

  // --- Redesign (Stage 4) ---
  getInvoiceManagement: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/${id}`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to fetch invoice management data');
    return json.data;
  },
  deleteReceipt: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/receipts/${id}`, {
      method: 'DELETE',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to delete receipt');
    return json;
  },
  voidReceipt: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/receipts/${id}/void`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to void receipt');
    return json;
  },

  createReceipt: async (invoiceId: string, name?: string): Promise<{ success: boolean; id: string }> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/receipts`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to create receipt');
    return json;
  },

  finaliseReceipt: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/receipts/${id}/finalise`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to finalise receipt');
    return json;
  },
  finaliseInvoice: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/${id}/finalise`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to finalise invoice');
    return json;
  },
  previewReceipt: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/receipts/${id}/preview`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to preview receipt');
    return json;
  },
  previewInvoice: async (id: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/${id}/preview`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to preview invoice');
    return json;
  },

  /**
   * Update workflow flags on an invoice (e.g. boqTaskSource). Bypasses the
   * lock that gates content edits, since these are project-management
   * controls, not document content.
   */
  updateInvoiceSettings: async (
    id: string,
    settings: { boqTaskSource?: boolean },
  ): Promise<{ boqTaskSource?: boolean }> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices/${id}/settings`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to update invoice settings');
    return json.data || {};
  },

  createInvoice: async (name: string, content: any, projectId: string, userId: string): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, payload: content, projectId, userId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to create invoice');
    return json;
  },

  addProjectMember: async (projectId: string, email: string, role: string = 'viewer'): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/projects/${projectId}/members`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to add member');
    return json;
  },

  // ─── Tasks (Phase 1) ────────────────────────────────────────────────────
  // The rich Task entity lives at /api/tasks. Tasks are project-scoped; the
  // backend stamps a `taskCode` (e.g. TSK-001) per project on insert.

  listTasks: async (
    projectId: string,
    filters: { status?: string; priority?: string; assigneeId?: string } = {}
  ): Promise<any[]> => {
    const headers = await authHeaders();
    const qs = new URLSearchParams({ projectId });
    if (filters.status) qs.set('status', filters.status);
    if (filters.priority) qs.set('priority', filters.priority);
    if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId);
    const res = await fetch(`${API_BASE}/tasks?${qs.toString()}`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load tasks');
    return json.data || [];
  },

  getTask: async (id: string): Promise<any | null> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/tasks/${id}`, { headers });
    const json = await res.json();
    return json.success ? json.data : null;
  },

  createTask: async (input: {
    projectId: string;
    title: string;
    details?: string;
    status?: 'pending' | 'progress' | 'done' | 'cancelled';
    priority?: 'low' | 'med' | 'high';
    deadline?: string | null;
    supervisorId?: string | null;
    assigneeId?: string | null;
    crewIds?: string[];
    materials?: Array<{ name: string; quantity?: number | string; unit?: string; note?: string }>;
    budget?: number | null;
    locationType?: 'zone' | 'text' | null;
    locationDocId?: string | null;
    locationZoneId?: string | null;
    locationText?: string | null;
    metadata?: Record<string, any>;
  }): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to create task');
    return json.data;
  },

  updateTask: async (id: string, patch: Record<string, any>): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to update task');
    return json.data;
  },

  deleteTask: async (id: string): Promise<void> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to delete task');
  },

  // ─── Execution: Stages, Milestones, Plan ────────────────────────────────
  // Hierarchy: project → stages (phases) → milestones → tasks.

  listStages: async (projectId: string): Promise<any[]> => {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/execution/stages?projectId=${encodeURIComponent(projectId)}`,
      { headers },
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load stages');
    return json.data || [];
  },

  createStage: async (input: {
    projectId: string;
    name: string;
    timeline?: string | null;
    description?: string | null;
    note?: string | null;
    position?: number;
    status?: 'pending' | 'active' | 'done' | 'cancelled';
  }): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/stages`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to create stage');
    return json.data;
  },

  updateStage: async (id: string, patch: Record<string, any>): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/stages/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to update stage');
    return json.data;
  },

  deleteStage: async (id: string): Promise<void> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/stages/${id}`, { method: 'DELETE', headers });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to delete stage');
  },

  createMilestone: async (input: {
    stageId: string;
    name: string;
    description?: string | null;
    note?: string | null;
    position?: number;
    status?: 'pending' | 'active' | 'done' | 'cancelled';
  }): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/milestones`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to create milestone');
    return json.data;
  },

  updateMilestone: async (id: string, patch: Record<string, any>): Promise<any> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/milestones/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to update milestone');
    return json.data;
  },

  deleteMilestone: async (id: string): Promise<void> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/milestones/${id}`, { method: 'DELETE', headers });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to delete milestone');
  },

  getExecutionPlan: async (projectId: string): Promise<{ estimatedTimeline?: string; conditions?: string }> => {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/execution/plan?projectId=${encodeURIComponent(projectId)}`,
      { headers },
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load execution plan');
    return json.data || {};
  },

  updateExecutionPlan: async (
    projectId: string,
    patch: { estimatedTimeline?: string; conditions?: string },
  ): Promise<{ estimatedTimeline?: string; conditions?: string }> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/plan`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ...patch }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to update execution plan');
    return json.data || {};
  },

  applyExecutionTemplate: async (projectId: string, force = false): Promise<{ stages: number }> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/execution/template/apply`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, force }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error || 'Failed to apply template');
    return json.data || { stages: 0 };
  },
};
