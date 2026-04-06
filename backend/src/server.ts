import express from 'express';
import cors from 'cors';
import { Server } from '@hocuspocus/server';
import expressWebsockets from 'express-ws';
import { initializeFirebase } from './config/firebase';
import { dbUtil } from './db/dbUtil';

// 1. Initialize Firebase (mocked until serviceAccountKey is present)
initializeFirebase();

// 2. Setup Express
const { app } = expressWebsockets(express());

app.use(cors());
app.use(express.json());

// 3. Configure Hocuspocus (CRDT WebSocket Server)
// @ts-ignore
const hocuspocusServer = Server.configure({
  // The name of your server
  name: 'shan-doc-printer-backend',

  // Hooks to integrate with your Database Abstraction
  async onLoadDocument(data: any) {
    // When a user joins, load the invoice state from the database
    // "data.documentName" will be the invoice ID (e.g. "invoice-123")
    console.log(`[Hocuspocus] onLoadDocument: ${data.documentName}`);
    
    // fetch from our dbUtil layer
    const invoiceJson = await dbUtil.fetchOne('invoices', data.documentName);
    
    // We must return the raw Yjs Uint8Array document if we are storing the binary
    // OR we just return the document and let the frontend initialize it if it's empty
    return data.document; // For now returning the blank/in-memory document to allow clients to sync
  },

  async onStoreDocument(data: any) {
    console.log(`[Hocuspocus] onStoreDocument: ${data.documentName}`);
    
    // Extract the JSON state from the Yjs CRDT 'invoice' map
    // We get the Y.Map named "invoiceStore" (this needs to match what we define in React)
    const invoiceMap = data.document.getMap('invoiceStore');
    const invoiceJson = invoiceMap.toJSON();

    // Persist this structured JSON via dbUtil
    // This fully decouples the Yjs system from Firebase
    await dbUtil.saveOne('invoices', data.documentName, invoiceJson);
  },
});

// 4. Mount Hocuspocus to a WebSocket route on Express
app.ws('/collaboration', (websocket: any, request: any) => {
  // @ts-ignore
  hocuspocusServer.handleConnection(websocket, request);
});

// 5. Standard REST APIs (Using same dbUtil)
app.get('/api/invoices/:id', async (req: express.Request, res: express.Response) => {
  try {
    const data = await dbUtil.fetchOne('invoices', req.params.id as string);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.post('/api/invoices', async (req: express.Request, res: express.Response) => {
  try {
    // Generates random ID or use provided one
    const id = req.body.id || `inv_${Date.now()}`;
    await dbUtil.saveOne('invoices', id, req.body.payload);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 6. Start the server
const PORT = process.env.PORT || 1234;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`✅ CRDT WebSocket Server running on ws://localhost:${PORT}/collaboration`);
});
