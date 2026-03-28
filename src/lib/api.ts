import { DocData, InvoiceCode } from "../types";
import { TEMPLATES, TemplateDefinition } from "./templates";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  name: string;
  content: DocData;
  folderId: string | null;
  invoiceId?: string | null;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

// Simulated latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get from localStorage
const getFromStorage = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Failed to parse ${key} from localStorage:`, e);
    return [];
  }
};

// Helper to save to localStorage
const saveToStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Initialization ---
const seedIfEmpty = () => {
  const folders = getFromStorage<Folder>("folders");
  const documents = getFromStorage<Document>("documents");
  const templates = getFromStorage<TemplateDefinition>("templates");
  
  if (folders.length === 0 && documents.length === 0) {
    const welcomeDoc: Document = {
      id: crypto.randomUUID(),
      name: "Welcome to Shan Docs",
      content: {
        contact: { name: "OLUWAKEMI ISINKAYE", address1: "Prime Waters Garden II", address2: "Lekki Phase 1" },
        title: "Welcome to Shan Docs",
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        table: { 
          columns: [
            { id: "A", label: "S/N", type: "index", width: "60px" },
            { id: "B", label: "Description", type: "text" },
            { id: "C", label: "Qty", type: "number", width: "80px" },
            { id: "D", label: "Price", type: "number", width: "140px" },
            { id: "E", label: "Total", type: "formula", formula: "C * D", width: "140px" }
          ], 
          rows: [{ id: "welcome-row-1", rowType: "row", B: "Introduction to your new DMS", C: 1, D: 0 }], 
          summary: [{ id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }] 
        },
        footer: { notes: "<p>Welcome! This is your first document. You can create folders and more documents from the dashboard.</p>", emphasis: [] }
      },
      folderId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage("documents", [welcomeDoc]);
  }

  const missingTemplates = TEMPLATES.filter(
    (bt) => !templates.some((t) => t.id === bt.id),
  );
  if (missingTemplates.length > 0) {
    saveToStorage("templates", [...templates, ...missingTemplates]);
  }
};

seedIfEmpty();

export const api = {
  // --- Folders ---
  getFolders: async (parentId: string | null = null): Promise<Folder[]> => {
    await delay(300);
    const folders = getFromStorage<Folder>("folders");
    return folders.filter(f => f.parentId === parentId);
  },

  createFolder: async (name: string, parentId: string | null = null): Promise<Folder> => {
    await delay(300);
    const folders = getFromStorage<Folder>("folders");
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage("folders", [...folders, newFolder]);
    return newFolder;
  },

  renameFolder: async (id: string, name: string): Promise<Folder> => {
    await delay(300);
    const folders = getFromStorage<Folder>("folders");
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) throw new Error("Folder not found");
    folders[index] = { ...folders[index], name, updatedAt: new Date().toISOString() };
    saveToStorage("folders", folders);
    return folders[index];
  },

  deleteFolder: async (id: string): Promise<void> => {
    await delay(300);
    const folders = getFromStorage<Folder>("folders").filter(f => f.id !== id);
    const documents = getFromStorage<Document>("documents").filter(d => d.folderId !== id);
    saveToStorage("folders", folders);
    saveToStorage("documents", documents);
  },

  moveFolder: async (id: string, newParentId: string | null): Promise<Folder> => {
    await delay(300);
    const folders = getFromStorage<Folder>("folders");
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) throw new Error("Folder not found");
    folders[index] = { ...folders[index], parentId: newParentId, updatedAt: new Date().toISOString() };
    saveToStorage("folders", folders);
    return folders[index];
  },

  // --- Documents ---
  getDocuments: async (folderId: string | null = null): Promise<Document[]> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    return documents.filter(d => d.folderId === folderId);
  },

  getDocument: async (id: string): Promise<Document | null> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    return documents.find(d => d.id === id) || null;
  },

  createDocument: async (name: string, content: DocData, folderId: string | null = null): Promise<Document> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    const newDoc: Document = {
      id: crypto.randomUUID(),
      name,
      content,
      folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage("documents", [...documents, newDoc]);
    return newDoc;
  },

  updateDocument: async (id: string, updates: Partial<Document>): Promise<Document> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    const index = documents.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Document not found");
    documents[index] = { ...documents[index], ...updates, updatedAt: new Date().toISOString() };
    saveToStorage("documents", documents);
    return documents[index];
  },

  deleteDocument: async (id: string): Promise<void> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents").filter(d => d.id !== id);
    saveToStorage("documents", documents);
  },

  duplicateDocument: async (id: string): Promise<Document> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    const original = documents.find(d => d.id === id);
    if (!original) throw new Error("Document not found");
    const newDoc: Document = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage("documents", [...documents, newDoc]);
    return newDoc;
  },

  moveDocument: async (id: string, newFolderId: string | null): Promise<Document> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    const index = documents.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Document not found");
    documents[index] = { ...documents[index], folderId: newFolderId, updatedAt: new Date().toISOString() };
    saveToStorage("documents", documents);
    return documents[index];
  },

  // --- Templates ---
  getTemplates: async (): Promise<TemplateDefinition[]> => {
    await delay(300);
    const templates = getFromStorage<TemplateDefinition>("templates");
    // Sort pinned templates to the front
    return templates.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  },

  saveTemplate: async (template: TemplateDefinition): Promise<TemplateDefinition> => {
    await delay(300);
    const templates = getFromStorage<TemplateDefinition>("templates");
    const index = templates.findIndex(t => t.id === template.id);
    if (index === -1) {
      templates.push(template);
    } else {
      templates[index] = template;
    }
    saveToStorage("templates", templates);
    return template;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await delay(300);
    const templates = getFromStorage<TemplateDefinition>("templates").filter(t => t.id !== id);
    saveToStorage("templates", templates);
  },

  togglePinTemplate: async (id: string): Promise<TemplateDefinition> => {
    await delay(300);
    const templates = getFromStorage<TemplateDefinition>("templates");
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Template not found");
    templates[index] = { ...templates[index], isPinned: !templates[index].isPinned };
    saveToStorage("templates", templates);
    return templates[index];
  },

  // --- Global Counters ---
  getNextReceiptNumber: (): string => {
    const counter = Number(localStorage.getItem("shan_receipt_counter") || "0") + 1;
    localStorage.setItem("shan_receipt_counter", String(counter));
    const year = new Date().getFullYear();
    return `REC/IS/${String(counter).padStart(4, "0")}/${year}`;
  },

  /** Read what the next invoice number will be WITHOUT consuming it (for form previews). */
  peekNextInvoiceNumber: (): string => {
    const counter = Number(localStorage.getItem("shan_invoice_counter") || "0") + 1;
    const year = new Date().getFullYear();
    return `INV/IS/${String(counter).padStart(4, "0")}/${year}`;
  },

  /** Returns a full InvoiceCode object with a globally unique number assigned at creation time. */
  getNextInvoiceNumber: (): InvoiceCode => {
    const counter = Number(localStorage.getItem("shan_invoice_counter") || "0") + 1;
    localStorage.setItem("shan_invoice_counter", String(counter));
    const year = new Date().getFullYear();
    const count = String(counter).padStart(4, "0");
    return {
      text: `INV/IS/${count}/${year}`,
      prefix: "INV",
      count,
      year: String(year),
      x: 600,
      y: 100,
      color: "#503D36",
    };
  },

  /** Legacy: returns just the padded count string. Used as editor fallback for old documents. */
  getNextInvoiceCount: (): string => {
    const counter = Number(localStorage.getItem("shan_invoice_counter") || "0") + 1;
    localStorage.setItem("shan_invoice_counter", String(counter));
    return String(counter).padStart(4, "0");
  },

  // --- Invoice-Receipt Linking ---
  getReceiptsForInvoice: async (invoiceId: string): Promise<Document[]> => {
    await delay(200);
    const documents = getFromStorage<Document>("documents");
    return documents.filter(d => d.invoiceId === invoiceId && d.content?.isReceipt);
  },

  /** Search all documents across all folders by name, number, title, client, reference, date. */
  searchAll: async (query: string): Promise<Document[]> => {
    if (!query.trim()) return [];
    await delay(150);
    const documents = getFromStorage<Document>("documents");
    const q = query.toLowerCase().trim();
    return documents.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      (d.content?.title || "").toLowerCase().includes(q) ||
      (d.content?.invoiceCode?.text || "").toLowerCase().includes(q) ||
      (d.content?.contact?.name || "").toLowerCase().includes(q) ||
      (d.content?.reference || "").toLowerCase().includes(q) ||
      (d.content?.date || "").toLowerCase().includes(q)
    );
  },

  /** Fetch every document regardless of folder (for ID lookups). */
  getAllDocuments: async (): Promise<Document[]> => {
    await delay(100);
    return getFromStorage<Document>("documents");
  },

  createReceiptDocument: async (data: DocData, invoiceId: string): Promise<Document> => {
    await delay(300);
    const documents = getFromStorage<Document>("documents");
    const newDoc: Document = {
      id: crypto.randomUUID(),
      name: data.invoiceCode?.text || "Receipt",
      content: data,
      folderId: null,
      invoiceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage("documents", [...documents, newDoc]);
    return newDoc;
  },
};
