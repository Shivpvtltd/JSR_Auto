/**
 * Firebase Initialization
 */

const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return admin;
  }
  
  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized');
    
    return admin;
  } catch (error) {
    logger.error('Firebase initialization error:', error);
    throw error;
  }
};

const getFirestore = () => {
  if (!firebaseInitialized) {
    initializeFirebase();
  }
  return admin.firestore();
};

const getStorage = () => {
  if (!firebaseInitialized) {
    initializeFirebase();
  }
  return admin.storage();
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getStorage,
  admin
};
