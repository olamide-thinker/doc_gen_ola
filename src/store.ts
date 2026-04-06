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
// SyncedStore strictly requires `{}` or `[]` as initializers
export const store = syncedStore({ invoiceStore: {} as Partial<InvoiceState> });

// 3. Connect to the new NodeJS Backend (Hocuspocus)
// We moved Hocuspocus to port 1235 to ensure pure WebSocket connections without Express wrapper issues.
export const provider = new HocuspocusProvider({
  url: "ws://localhost:1235",
  name: "invoice-demo-123", // This is the ID that gets passed to dbUtil.fetchOne(id)
  document: getYjsDoc(store),
});

provider.on('status', (event: any) => {
  console.log('[Hocuspocus] Connection status:', event.status);
});
