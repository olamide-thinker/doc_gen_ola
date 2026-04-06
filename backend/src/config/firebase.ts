import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// You will need to provide a serviceAccountKey.json later
// For now, we stub it out or initialize with a placeholder if run

let isFirebaseInitialized = false;

export const initializeFirebase = () => {
  if (isFirebaseInitialized) return;

  try {
    // You provided the "Client SDK" configuration. 
    // To connect a Node.js Backend securely, Firebase requires a "Service Account Key".
    
    // 1. Go to Firebase Console -> Project Settings -> Service Accounts
    // 2. Click "Generate new private key"
    // 3. Save the downloaded file as `backend/src/config/serviceAccountKey.json`
    
    // Uncomment the following once you have that file:
    /*
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "invoice-crdt-sys"
    });
    console.log('[Firebase] ✅ Admin SDK successfully initialized!');
    isFirebaseInitialized = true;
    */

    // For now, it remains mocked to prevent crashes
    console.log('[Firebase] ⚠️ Waiting for serviceAccountKey.json. DB calls are mocked.');
  } catch (error) {
    console.error('[Firebase] Failed to initialize admin SDK', error);
  }
};

export const getFirestore = () => {
  return admin.firestore();
};
