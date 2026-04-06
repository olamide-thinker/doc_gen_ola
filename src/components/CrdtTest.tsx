import React from "react";
import { useSyncedStore } from "@syncedstore/react";
import { store } from "../store";

export default function CrdtTest() {
  // Use the synced store. It triggers a re-render exactly like React State!
  const state = useSyncedStore(store);

  const handleAddItem = () => {
    if (!state.invoiceStore.items) {
      // @ts-ignore - Initialize if undefined
      state.invoiceStore.items = [];
    }
    // We mutate the store directly, Yjs handles the sync!
    state.invoiceStore.items!.push({
      id: Math.random().toString(36).substring(2, 11),
      description: "New Item",
      quantity: 1,
      unitPrice: 100,
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto bg-card rounded-xl shadow-lg mt-10 text-foreground">
      <h1 className="text-3xl font-bold mb-6 text-primary">Live CRDT Collaboration Test</h1>
      
      <p className="text-sm text-muted-foreground mb-8">
        Open this page in two different browser windows side-by-side. 
        Type in one, and watch the other update instantly via WebSockets!
      </p>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Customer Name</label>
        <input
          className="w-full p-3 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary outline-none transition-shadow"
          value={state.invoiceStore.customerName || ""}
          onChange={(e) => {
            // Instant mutation! No setState needed, SyncedStore handles it.
            state.invoiceStore.customerName = e.target.value;
          }}
          placeholder="Start typing..."
        />
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <label className="text-sm font-semibold">Line Items</label>
          <button 
            onClick={handleAddItem}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
          >
            + Add Item
          </button>
        </div>

        <div className="space-y-3">
          {state.invoiceStore.items && state.invoiceStore.items.length === 0 && (
            <div className="text-sm text-muted-foreground italic">No items yet...</div>
          )}
          
          {state.invoiceStore.items?.map((item, index) => (
            <div key={item.id} className="flex gap-4 items-center bg-background p-3 rounded-md border border-border">
              <input
                className="flex-1 p-2 bg-transparent border-b border-border outline-none focus:border-primary"
                value={item.description}
                onChange={(e) => (item.description = e.target.value)}
                placeholder="Description"
              />
              <input
                type="number"
                className="w-20 p-2 bg-transparent border-b border-border outline-none focus:border-primary text-center"
                value={item.quantity}
                onChange={(e) => (item.quantity = Number(e.target.value))}
              />
              <button 
                onClick={() => state.invoiceStore.items!.splice(index, 1)}
                className="text-destructive hover:underline text-sm font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
