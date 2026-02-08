import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// When using emulators, use the project ID from environment variable or default
// This ensures the frontend and emulator use the same project ID
const getProjectId = () => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    // In emulator mode, use the emulator project ID from env or default
    return import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT_ID || 'content-generator-76416';
  }
  return import.meta.env.VITE_FIREBASE_PROJECT_ID;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: getProjectId(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
console.log('Initializing Firebase with config:', firebaseConfig);
console.log('🔧 Using project ID:', firebaseConfig.projectId, import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true' ? '(emulator mode)' : '(production mode)');
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);        // → storageService.ts (Firestore persistence)
export const auth = getAuth(app);           // → authService.ts
export const storage = getStorage(app);     // → fileStorage.ts
// Initialize functions with explicit region for emulator compatibility
export const functions = getFunctions(app, 'us-central1'); // → geminiService.ts (Cloud Function calls)

// Connect to emulators in development mode
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    const authEmulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_HOST || 'http://127.0.0.1:9099';
    const functionsEmulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_FUNCTIONS_HOST || '127.0.0.1';
    const functionsEmulatorPort = parseInt(import.meta.env.VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT || '5001', 10);
    const firestoreEmulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_HOST || '127.0.0.1';
    const firestoreEmulatorPort = parseInt(import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT || '8080', 10);

    connectAuthEmulator(auth, authEmulatorHost, { disableWarnings: true });
    connectFunctionsEmulator(functions, functionsEmulatorHost, functionsEmulatorPort);
    connectFirestoreEmulator(db, firestoreEmulatorHost, firestoreEmulatorPort);
    console.log('✅ Connected to Firebase emulators');
    console.log('📋 Project ID:', firebaseConfig.projectId);
    console.log('🔗 Functions URL:', `http://${functionsEmulatorHost}:${functionsEmulatorPort}/${firebaseConfig.projectId}/us-central1/`);
  } catch (error) {
    console.warn('⚠️ Emulator connection error (may already be connected):', error);
  }
}
