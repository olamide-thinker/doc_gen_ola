import { syncedStore } from "@syncedstore/core";
import { workspaceStore, authStore, authProvider, type WorkspaceFolder, type WorkspaceDocument, type WorkspaceProject } from "../store";
import { type DocData, type InvoiceCode } from "../types";
import { type TemplateDefinition, TEMPLATES } from "./templates";

// Helper to save to local storage (for templates only)
const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(`invsys_${key}`, JSON.stringify(data));
};

const getFromStorage = (key: string, fallback: any) => {
  // Check new brand first, fallback to old brand for migration
  let data = localStorage.getItem(`invsys_${key}`);
  if (!data) {
    data = localStorage.getItem(`shan_${key}`);
    if (data) localStorage.setItem(`invsys_${key}`, data); // Migrate
  }
  return data ? JSON.parse(data) : fallback;
};

// Initial data migration from localStorage to SyncedStore
const migrateData = () => {
  const folders = getFromStorage("folders", []);
  const documents = getFromStorage("documents", []);

  // Ensure Playground project exists
  if (workspaceStore.projects.length === 0) {
    const initialProjectName = localStorage.getItem('invsys_initial_project');
    if (initialProjectName) {
      workspaceStore.projects.push({
        id: crypto.randomUUID(),
        name: initialProjectName,
        createdAt: new Date().toISOString()
      });
      localStorage.removeItem('invsys_initial_project');
    }

    workspaceStore.projects.push({
      id: "playground",
      name: "Playground",
      createdAt: new Date().toISOString()
    });
  }

  if (workspaceStore.folders.length === 0 && folders.length > 0) {
    workspaceStore.folders.push(...folders.map((f: any) => ({ ...f, projectId: f.projectId || "playground" })));
  } else {
    // Migrate existing synced folders
    workspaceStore.folders.forEach(f => {
        if (!f.projectId) f.projectId = "playground";
    });
  }

  if (workspaceStore.documents.length === 0 && documents.length > 0) {
    workspaceStore.documents.push(...documents.map((d: any) => ({ ...d, projectId: d.projectId || "playground" })));
  } else {
    // Migrate existing synced documents
    workspaceStore.documents.forEach(d => {
        if (!d.projectId) d.projectId = "playground";
    });
  }
};

migrateData();

export const api = {
  // --- Folders ---
  getFolders: async (projectId: string, parentId: string | null = null): Promise<WorkspaceFolder[]> => {
    return workspaceStore.folders.filter(f => f.projectId === projectId && f.parentId === parentId) as WorkspaceFolder[];
  },

  getFolder: async (id: string): Promise<WorkspaceFolder | null> => {
    return (workspaceStore.folders.find(f => f.id === id) as WorkspaceFolder) || null;
  },

  getFolderPath: async (id: string | null): Promise<WorkspaceFolder[]> => {
    if (!id) return [];
    const allFolders = workspaceStore.folders;
    const path: WorkspaceFolder[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder as WorkspaceFolder);
        currentId = folder.parentId;
      } else {
        currentId = null;
      }
    }
    return path;
  },

  createFolder: async (name: string, projectId: string, parentId: string | null = null): Promise<WorkspaceFolder> => {
    const newFolder: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspaceStore.folders.push(newFolder);
    return newFolder;
  },

  renameFolder: async (id: string, name: string): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) throw new Error("Folder not found");
    folders[index].name = name;
    folders[index].updatedAt = new Date().toISOString();
    return folders[index] as WorkspaceFolder;
  },

  deleteFolder: async (id: string): Promise<void> => {
    const fIdx = workspaceStore.folders.findIndex(f => f.id === id);
    if (fIdx !== -1) workspaceStore.folders.splice(fIdx, 1);
    
    // Cleanup documents in this folder 
    const docs = workspaceStore.documents;
    for (let i = docs.length - 1; i >= 0; i--) {
        if (docs[i].folderId === id) docs.splice(i, 1);
    }
  },

  moveFolder: async (id: string, newParentId: string | null): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) throw new Error("Folder not found");
    folders[index].parentId = newParentId;
    folders[index].updatedAt = new Date().toISOString();
    return folders[index] as WorkspaceFolder;
  },

  duplicateFolderToFolder: async (id: string, targetParentId: string | null): Promise<WorkspaceFolder> => {
    const folders = workspaceStore.folders;
    const documents = workspaceStore.documents;
    const original = folders.find(f => f.id === id);
    if (!original) throw new Error("Folder not found");
    
    const newFolderId = crypto.randomUUID();
    const newFolder: WorkspaceFolder = {
      ...original,
      id: newFolderId,
      name: `${original.name} (Copy)`,
      parentId: targetParentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    folders.push(newFolder);

    // Duplicate documents in folder
    documents.filter(d => d.folderId === id).forEach(d => {
      api.createDocument(d.name, d.content, d.projectId || "playground", newFolderId);
    });

    return newFolder;
  },

  // --- Documents ---
  getDocuments: async (projectId: string, folderId: string | null = null): Promise<WorkspaceDocument[]> => {
    return workspaceStore.documents.filter(d => d.projectId === projectId && d.folderId === folderId) as unknown as WorkspaceDocument[];
  },

  getDocument: async (id: string): Promise<WorkspaceDocument | null> => {
    return (workspaceStore.documents.find(d => d.id === id) as unknown as WorkspaceDocument) || null;
  },

  createDocument: async (name: string, content: any, projectId: string, folderId: string | null = null): Promise<WorkspaceDocument> => {
    const newDoc: WorkspaceDocument = {
      id: crypto.randomUUID(),
      name,
      content,
      folderId,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspaceStore.documents.push(newDoc);
    return newDoc;
  },

  updateDocument: async (id: string, content: any): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    const index = docs.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Document not found");
    docs[index].content = content;
    docs[index].updatedAt = new Date().toISOString();
    return docs[index] as unknown as WorkspaceDocument;
  },

  renameDocument: async (id: string, name: string): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    const index = docs.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Document not found");
    docs[index].name = name;
    docs[index].updatedAt = new Date().toISOString();
    return docs[index] as unknown as WorkspaceDocument;
  },

  deleteDocument: async (id: string): Promise<void> => {
    const idx = workspaceStore.documents.findIndex(d => d.id === id);
    if (idx !== -1) workspaceStore.documents.splice(idx, 1);
  },

  moveDocument: async (id: string, newFolderId: string | null): Promise<WorkspaceDocument> => {
    const docs = workspaceStore.documents;
    const index = docs.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Document not found");
    docs[index].folderId = newFolderId;
    docs[index].updatedAt = new Date().toISOString();
    return docs[index] as unknown as WorkspaceDocument;
  },

  duplicateDocument: async (id: string): Promise<WorkspaceDocument> => {
    const original = workspaceStore.documents.find(d => d.id === id);
    if (!original) throw new Error("Document not found");
    return api.createDocument(`${original.name} (Copy)`, original.content, original.projectId || "playground", original.folderId);
  },

  duplicateDocumentToFolder: async (id: string, targetFolderId: string | null): Promise<WorkspaceDocument> => {
    const original = workspaceStore.documents.find(d => d.id === id);
    if (!original) throw new Error("Document not found");
    return api.createDocument(`${original.name} (Copy)`, original.content, original.projectId || "playground", targetFolderId);
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

  togglePinTemplate: async (id: string): Promise<TemplateDefinition> => {
    const templates = await api.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Template not found");
    templates[index].isPinned = !templates[index].isPinned;
    saveToStorage("templates", templates);
    return templates[index];
  },

  // --- Counters ---
  getNextReceiptNumber: (): string => {
    const counter = Number(localStorage.getItem("invsys_receipt_counter") || localStorage.getItem("shan_receipt_counter") || "0") + 1;
    localStorage.setItem("invsys_receipt_counter", String(counter));
    return `REC/IP/${String(counter).padStart(4, "0")}/${new Date().getFullYear()}`;
  },

  peekNextInvoiceNumber: (): string => {
    const counter = Number(localStorage.getItem("invsys_invoice_counter") || localStorage.getItem("shan_invoice_counter") || "0") + 1;
    return `INV/IP/${String(counter).padStart(4, "0")}/${new Date().getFullYear()}`;
  },

  getNextInvoiceNumber: (): InvoiceCode => {
    const counter = Number(localStorage.getItem("invsys_invoice_counter") || localStorage.getItem("shan_invoice_counter") || "0") + 1;
    localStorage.setItem("invsys_invoice_counter", String(counter));
    const year = new Date().getFullYear();
    const count = String(counter).padStart(4, "0");
    return { text: `INV/IP/${count}/${year}`, prefix: "INV", count, year: String(year), x: 600, y: 100, color: "#503D36" };
  },

  getNextInvoiceCount: (): string => {
    return String(localStorage.getItem("invsys_invoice_counter") || localStorage.getItem("shan_invoice_counter") || "0").padStart(4, "0");
  },

  searchAll: async (query: string): Promise<WorkspaceDocument[]> => {
    if (!query.trim()) return [];
    const documents = workspaceStore.documents;
    const q = query.toLowerCase().trim();
    return documents.filter((d) => 
      d.name.toLowerCase().includes(q) ||
      (d.content?.invoiceCode?.text || "").toLowerCase().includes(q) ||
      (d.content?.contact?.name || "").toLowerCase().includes(q)
    ) as unknown as WorkspaceDocument[];
  },

  getAllDocuments: async (): Promise<WorkspaceDocument[]> => {
    return workspaceStore.documents as unknown as WorkspaceDocument[];
  },

  reorderItems: async (folderId: string | null, activeId: string, overId: string): Promise<void> => {
    const isFolder = activeId.startsWith('f-');
    const realActiveId = activeId.replace(isFolder ? 'f-' : 'd-', '');
    const realOverId = overId.replace(isFolder ? 'f-' : 'd-', '');

    if (isFolder) {
      const folders = [...workspaceStore.folders];
      const activeIdx = folders.findIndex(f => f.id === realActiveId);
      const overIdx = folders.findIndex(f => f.id === realOverId);
      if (activeIdx !== -1 && overIdx !== -1) {
        const [moved] = folders.splice(activeIdx, 1);
        folders.splice(overIdx, 0, moved);
        workspaceStore.folders.splice(0, workspaceStore.folders.length, ...folders);
      }
    } else {
      const docs = [...workspaceStore.documents];
      const activeIdx = docs.findIndex(d => d.id === realActiveId);
      const overIdx = docs.findIndex(d => d.id === realOverId);
      if (activeIdx !== -1 && overIdx !== -1) {
        const [moved] = docs.splice(activeIdx, 1);
        docs.splice(overIdx, 0, moved);
        workspaceStore.documents.splice(0, workspaceStore.documents.length, ...docs);
      }
    }
  },

  // --- Projects ---
  getProjects: async (): Promise<WorkspaceProject[]> => {
    return workspaceStore.projects as WorkspaceProject[];
  },

  createProject: async (name: string): Promise<WorkspaceProject> => {
    const newProj: WorkspaceProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    workspaceStore.projects.push(newProj);
    return newProj;
  },

  deleteProject: async (id: string): Promise<void> => {
    const idx = workspaceStore.projects.findIndex(p => p.id === id);
    if (idx !== -1) workspaceStore.projects.splice(idx, 1);

    // Cleanup project items
    const folders = workspaceStore.folders;
    for (let i = folders.length - 1; i >= 0; i--) {
        if (folders[i].projectId === id) folders.splice(i, 1);
    }
    const docs = workspaceStore.documents;
    for (let i = docs.length - 1; i >= 0; i--) {
        if (docs[i].projectId === id) docs.splice(i, 1);
    }
  },
};
