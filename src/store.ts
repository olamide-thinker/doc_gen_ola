import { syncedStore, getYjsDoc } from "@syncedstore/core";
import { HocuspocusProvider } from "@hocuspocus/provider";

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

// 2. Create the SyncedStore
// This creates a Y.Map under the hood named "invoiceStore"
export const store = syncedStore({ invoiceStore: {} as InvoiceState });

// 3. Connect to the new NodeJS Backend (Hocuspocus)
// By default, it connects to localhost:1234. Update this for production.
export const provider = new HocuspocusProvider({
  url: "ws://127.0.0.1:1234/collaboration",
  name: "invoice-demo-123", // This is the ID that gets passed to dbUtil.fetchOne(id)
  document: getYjsDoc(store),
});

provider.on('status', (event: any) => {
  console.log('[Hocuspocus] Connection status:', event.status);
});
