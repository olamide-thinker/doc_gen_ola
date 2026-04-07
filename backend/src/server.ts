import express from 'express';
import cors from 'cors';
import { Server } from '@hocuspocus/server';
import expressWebsockets from 'express-ws';
import { initializeFirebase, getFirestore } from './config/firebase';
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

  // Authentication & Authorization Hook
  async onAuthenticate(data: any) {
    const { token, roomName } = data;
    
    if (!token) {
      console.error(`[Auth] Connection rejected: No token provided for room ${roomName}`);
      throw new Error('Unauthorized: No token provided');
    }

    try {
      const admin = await import('firebase-admin');
      let decodedToken;
      
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (e) {
        console.warn('[Auth] Firebase Admin not initialized or token invalid. Falling back (DEV ONLY).');
        return true; 
      }

      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // --- Hierarchical Permission Enforcement ---
      const db = getFirestore();

      if (roomName.startsWith('business-workspace-')) {
        const businessId = roomName.split('-').pop();
        const businessDoc = await db.collection('businesses').doc(businessId!).get();
        
        if (!businessDoc.exists) throw new Error('Business/Project not found');
        
        const data = businessDoc.data();
        const members = data?.members || [];
        
        // Phase 1: Project Membership
        if (!members.includes(email) && data?.ownerId !== uid) {
          console.error(`[Auth] User ${email} rejected from project room ${roomName}`);
          throw new Error('Forbidden: Not a member of this project');
        }
      } 
      else if (roomName.startsWith('doc-')) {
        const docId = roomName.replace('doc-', '');
        
        // We need to find the document in the workspace data or a dedicated table
        // For efficiency, let's assume we have a 'documentMeta' collection or check the 'invoices' data
        const docRef = db.collection('invoices').doc(docId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const members = docSnap.data()?.members || [];
            const ownerId = docSnap.data()?.ownerId;

            // Phase 2: File-level membership
            if (!members.includes(email) && ownerId !== uid) {
                console.error(`[Auth] User ${email} rejected from file room ${roomName}`);
                throw new Error('Forbidden: Not a member of this file');
            }
        }
      }

      console.log(`[Auth] User ${email} authorized for room ${roomName}`);
      return { user: { id: uid, email: email } };
    } catch (error: any) {
      console.error('[Auth] Authentication failed:', error.message);
      throw error;
    }
  },

  async onLoadDocument(data: any) {
    const { documentName, document } = data;
    console.log(`[Hocuspocus] onLoadDocument: ${documentName}`);
    
    if (documentName.startsWith('business-workspace-')) {
        const id = documentName.split('-').pop();
        const workspaceData = await dbUtil.fetchOne('workspaces', id!);
        if (workspaceData) {
            // Restore folders, documents, and projects maps
            if (workspaceData.folders) document.getArray('folders').insert(0, workspaceData.folders);
            if (workspaceData.documents) document.getArray('documents').insert(0, workspaceData.documents);
            if (workspaceData.projects) document.getArray('projects').insert(0, workspaceData.projects);
        }
    } 
    else if (documentName.startsWith('doc-')) {
        const id = documentName.replace('doc-', '');
        const invoiceData = await dbUtil.fetchOne('invoices', id);
        if (invoiceData) {
            const invoiceMap = document.getMap('invoiceStore');
            // Populate the map with saved data
            Object.entries(invoiceData).forEach(([key, value]) => {
                if (key !== 'id') invoiceMap.set(key, value);
            });
        }
    }
  },

  async onStoreDocument(data: any) {
    const { documentName, document } = data;
    console.log(`[Hocuspocus] onStoreDocument: ${documentName}`);
    
    if (documentName.startsWith('business-workspace-')) {
        const id = documentName.split('-').pop();
        const payload = {
            folders: document.getArray('folders').toJSON(),
            documents: document.getArray('documents').toJSON(),
            projects: document.getArray('projects').toJSON(),
            updatedAt: new Date().toISOString()
        };
        await dbUtil.saveOne('workspaces', id!, payload);
    } 
    else if (documentName.startsWith('doc-')) {
        const id = documentName.replace('doc-', '');
        const invoiceMap = document.getMap('invoiceStore');
        const payload = {
            ...invoiceMap.toJSON(),
            updatedAt: new Date().toISOString()
        };
        await dbUtil.saveOne('invoices', id, payload);
    }
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
