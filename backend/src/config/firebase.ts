import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// You will need to provide a serviceAccountKey.json later
// For now, we stub it out or initialize with a placeholder if run

let isFirebaseInitialized = false;

export const initializeFirebase = () => {
  if (isFirebaseInitialized) return;

  try {
    // If you have a service account file, place it in backend/src/config/serviceAccountKey.json
    // const serviceAccount = require('./serviceAccountKey.json');
    // admin.initializeApp({
    //   credential: admin.credential.cert(serviceAccount)
    // });
    
    // For now, we won't throw an error, we will just log it
    console.log('[Firebase] Waiting for serviceAccountKey.json to actually authenticate.');
    console.log('[Firebase] Until then, db operations will be mocked or will fail if hit directly.');
    isFirebaseInitialized = true;
  } catch (error) {
    console.error('[Firebase] Failed to initialize admin SDK', error);
  }
};

export const getFirestore = () => {
  return admin.firestore();
};
