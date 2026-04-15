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

const formatPrivateKey = (key: string) => {
  if (!key) return key;
  
  // 1. Basic cleanup of surrounding quotes and escaped newlines
  let cleaned = key.trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');

  // 2. Aggressive PEM re-formatting
  // PEM/ASN.1 parsers are extremely sensitive to line lengths and illegal characters.
  // We extract the raw base64 body, strip all existing whitespace, and re-wrap correctly.
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';

  if (cleaned.includes(header) && cleaned.includes(footer)) {
    const startIndex = cleaned.indexOf(header) + header.length;
    const endIndex = cleaned.indexOf(footer);
    
    // Get the base64 portion and remove ALL whitespace (newlines, spaces, etc.)
    const base64Body = cleaned.substring(startIndex, endIndex).replace(/\s+/g, '');
    
    // Re-wrap to standard 64 characters per line
    const wrappedBody = base64Body.match(/.{1,64}/g)?.join('\n') || base64Body;
    
    return `${header}\n${wrappedBody}\n${footer}\n`;
  }

  return cleaned;
};

let isFirebaseInitialized = false;

export const initializeFirebase = async () => {
  if (isFirebaseInitialized) return;

  console.log('[Firebase] 🛡️ Starting Secure Initialization...');

  try {
    let serviceAccount: any = null;
    
    // 1. Try JSON File (Smart Pathing) - This is the most reliable method
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

    // 2. Fallback to Individual Env Vars
    const projectId = process.env.FIREBASE_PROJECT_ID || "invoice-crdt-sys";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      privateKey = formatPrivateKey(privateKey);

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
      console.error('[Firebase] ❌ CRITICAL: No serviceAccountKey.json found and environment variables are incomplete.');
    }
  } catch (error: any) {
    console.error('[Firebase] ❌ Initialization Error:', error.message);
  }
};

// AUTO-INIT
initializeFirebase().catch(err => console.error('[Firebase] Auto-init failed:', err));

export const checkFirebaseInitialized = () => isFirebaseInitialized;
