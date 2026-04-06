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
const hocuspocusServer = new Server({
  // The name of your server
  name: 'shan-doc-printer-backend',

  // Hooks to integrate with your Database Abstraction
  async onLoadDocument(data: any) {
    // When a user joins, load the invoice state from the database
    // "data.documentName" will be the invoice ID (e.g. "invoice-123")
    console.log(`[Hocuspocus] onLoadDocument: ${data.documentName}`);
    
    // fetch from our dbUtil layer
    const invoiceJson = await dbUtil.fetchOne('invoices', data.documentName);
    
    // We can inject database content into the CRDT here later via Y.applyUpdate
    // Do NOT return data.document, it crashes the Hocuspocus pipeline.
    return;
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

// 4. Standard REST APIs (Using same dbUtil)
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

// 5. Start both servers
const EXPRESS_PORT = process.env.PORT || 1234;
app.listen(EXPRESS_PORT, () => {
  console.log(`✅ Express backend running on http://localhost:${EXPRESS_PORT}`);
});

// Start Hocuspocus independently on port 1235
hocuspocusServer.listen(1235).then(() => {
  console.log(`✅ CRDT WebSocket Server running securely on ws://localhost:1235`);
});
