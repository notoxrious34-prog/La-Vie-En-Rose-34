import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey) return null;

  return {
    apiKey,
    authDomain: authDomain ?? `${projectId ?? 'lavieenrose-e9e3c'}.firebaseapp.com`,
    projectId: projectId ?? 'lavieenrose-e9e3c',
    storageBucket: storageBucket ?? `${projectId ?? 'lavieenrose-e9e3c'}.appspot.com`,
    messagingSenderId: messagingSenderId ?? '',
    appId: appId ?? '',
  };
}

export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
}

export function getFirebaseApp() {
  const config = getFirebaseConfig();
  if (!config) return null;
  const existing = getApps();
  if (existing.length) return existing[0]!;
  return initializeApp(config);
}

export async function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) return null;
  const auth = getAuth(app);
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // ignore persistence errors
  }
  return auth;
}

export function getFirebaseFirestore() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}
