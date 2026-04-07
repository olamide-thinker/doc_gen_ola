import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin SDK
let isFirebaseInitialized = false;

export const initializeFirebase = () => {
  if (isFirebaseInitialized) return;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || "invoice-crdt-sys";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      console.log('[Firebase] ✅ Admin SDK successfully initialized via Env Vars!');
      isFirebaseInitialized = true;
    } else {
      // Fallback to local JSON if present
      const keyPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
      if (fs.existsSync(keyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
        console.log('[Firebase] ✅ Admin SDK successfully initialized via JSON!');
        isFirebaseInitialized = true;
      } else {
        console.warn('[Firebase] ⚠️ Missing credentials (Env or serviceAccountKey.json). Entering Mock Mode.');
      }
    }
  } catch (error) {
    console.error('[Firebase] Failed to initialize admin SDK', error);
  }
};

export const getFirestore = () => {
  if (!isFirebaseInitialized) {
    // Return a minimal mock that doesn't crash on common calls
    return {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: false, data: () => null }),
          set: async () => {},
          update: async () => {},
          delete: async () => {},
        }),
        where: () => ({ get: async () => ({ docs: [] }) }),
        orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
        limit: () => ({ get: async () => ({ docs: [] }) }),
        offset: () => ({ get: async () => ({ docs: [] }) }),
      })
    } as unknown as admin.firestore.Firestore;
  }
  return admin.firestore();
};

export const checkFirebaseInitialized = () => isFirebaseInitialized;
