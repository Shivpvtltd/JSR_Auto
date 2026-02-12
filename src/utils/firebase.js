/**
 * Firebase Initialization and Utilities
 */
const admin = require('firebase-admin');

let db = null;

function initializeFirebase() {
  if (db) return db;
  
  try {
    // Check if already initialized
    if (admin.apps.length === 0) {
      // For Render: use environment variable
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        // Fallback for local development with serviceAccountKey.json
        admin.initializeApp({
          credential: admin.credential.cert(require('../../serviceAccountKey.json'))
        });
      }
    }
    
    db = admin.firestore();
    console.log('✅ Firebase initialized');
    return db;
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

function getFirestore() {
  if (!db) {
    return initializeFirebase();
  }
  return db;
}

module.exports = {
  initializeFirebase,
  getFirestore,
  admin
};
