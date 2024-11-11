import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

// Only initialize if no apps exist
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS || '{}');
    
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    
    console.log('Firebase Admin initialized with:', {
      projectId: serviceAccount.project_id,
      bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const adminDb = getFirestore();
export const adminStorage = getStorage();

// Add validation helper
export function validateAdmin() {
  console.log('Validating Firebase Admin:', {
    hasDb: !!adminDb,
    hasStorage: !!adminStorage,
    bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    apps: getApps().length
  });
}