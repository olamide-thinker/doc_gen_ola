import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 1. Precise .env loading based on where we are
const currentDir = process.cwd();
const possibleEnvPaths = [
  path.join(currentDir, '.env'),
  path.join(currentDir, 'backend', '.env'),
  path.join(currentDir, '..', '.env')
];

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

let isFirebaseInitialized = false;

export const initializeFirebase = async () => {
  if (isFirebaseInitialized) return;

  console.log('[Firebase] 🛡️ Starting Secure Initialization...');

  try {
    // 1. Try JSON File first (Smart Pathing)
    let serviceAccount: any = null;
    
    // 0. Try process.env.FIRE_SECRET first
    if (process.env.FIRE_SECRET) {
      try {
        console.log('[Firebase] 🤫 Found FIRE_SECRET in environment variables.');
        serviceAccount = JSON.parse(process.env.FIRE_SECRET);
      } catch (err) {
        console.error('[Firebase] ❌ Failed to parse FIRE_SECRET:', err.message);
      }
    }

    // 1. Try JSON File next if FIRE_SECRET wasn't found or failed
    if (!serviceAccount) {
      const possibleJsonPaths = [
        path.join(currentDir, 'serviceAccountKey.json'),
        path.join(currentDir, 'backend', 'serviceAccountKey.json'),
        path.join(currentDir, '..', 'serviceAccountKey.json')
      ];

      for (const p of possibleJsonPaths) {
        if (fs.existsSync(p)) {
          console.log('[Firebase] ✨ Found JSON key file at:', p);
          serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      }
    }

    if (serviceAccount) {
      // If an app already exists, delete it so we can re-init with fresh keys
      if (admin.apps.length > 0) {
        await Promise.all(admin.apps.map(app => app?.delete()));
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isFirebaseInitialized = true;
      console.log('[Firebase] ✅ Admin SDK successfully initialized via JSON!');
      return;
    }

    // 2. Fallback to Env Vars
    const projectId = process.env.FIREBASE_PROJECT_ID || "invoice-crdt-sys";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      // CLEANUP: Ensure the private key is formatted correctly for ASN.1 parsing
      // 1. Remove literal quotes if they were accidentally included in the .env value
      privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
      // 2. Unescape \n characters
      privateKey = privateKey.replace(/\\n/g, '\n');

      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
      }
      isFirebaseInitialized = true;
      console.log('[Firebase] ✅ Admin SDK successfully initialized via Env Vars!');
    } else {
      console.error('[Firebase] ❌ CRITICAL: No credentials found.');
    }
  } catch (error: any) {
    console.error('[Firebase] ❌ Initialization Error:', error.message);
  }
};

// AUTO-INIT
initializeFirebase().catch(err => console.error('[Firebase] Auto-init failed:', err));

export const checkFirebaseInitialized = () => isFirebaseInitialized;
