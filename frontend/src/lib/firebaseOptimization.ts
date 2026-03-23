// Firebase optimization utilities
// Phase 3: Prevent multiple calls, add caching, load only needed collections

import type { AuthUser } from '../store/auth';

// Cache for Firebase auth state
let firebaseAuthCache: AuthUser | null = null;
let firebaseAuthCacheTime = 0;
const FIREBASE_CACHE_TTL = 30000; // 30 seconds

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

// Generic request deduplication
export function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

// Optimized Firebase auth with caching
export function getFirebaseAuthWithCache(): Promise<AuthUser | null> {
  const now = Date.now();
  
  // Return cached result if fresh
  if (firebaseAuthCache && (now - firebaseAuthCacheTime) < FIREBASE_CACHE_TTL) {
    return Promise.resolve(firebaseAuthCache);
  }

  // Dedupe concurrent auth requests
  return dedupeRequest('firebase-auth', async () => {
    try {
      const firebaseClient = await import('../lib/firebaseClient');
      const auth = await firebaseClient.getFirebaseAuth();
      
      if (!auth) {
        firebaseAuthCache = null;
        firebaseAuthCacheTime = now;
        return null;
      }

      const user = auth.currentUser;
      
      const authUser: AuthUser | null = user ? {
        id: user.uid,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
        username: user.displayName || user.email || 'Unknown',
        role: 'admin', // Default role for Firebase users
      } : null;

      firebaseAuthCache = authUser;
      firebaseAuthCacheTime = now;
      
      return authUser;
    } catch (error) {
      console.error('Firebase auth error:', error);
      firebaseAuthCache = null;
      firebaseAuthCacheTime = now;
      return null;
    }
  });
}

// Clear Firebase cache when needed
export function clearFirebaseAuthCache(): void {
  firebaseAuthCache = null;
  firebaseAuthCacheTime = 0;
  pendingRequests.delete('firebase-auth');
}

// Optimized Firestore collection loading
export function loadCollectionOnce<T>(
  collectionPath: string,
  transform?: (doc: any) => T
): Promise<T[]> {
  return dedupeRequest(`collection-${collectionPath}`, async () => {
    try {
      const { getFirebaseFirestore } = await import('../lib/firebaseClient');
      const db = getFirebaseFirestore();
      
      if (!db) {
        console.warn('Firestore not available, using empty array');
        return [] as T[];
      }

      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const q = query(collection(db, collectionPath), where('active', '==', true));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => 
        transform ? transform(doc.data()) : doc.data() as T
      );
    } catch (error) {
      console.error(`Error loading collection ${collectionPath}:`, error);
      return [] as T[];
    }
  });
}

// Preload only essential Firebase collections
export function preloadEssentialFirebaseData(): void {
  // Preload auth state in background
  void getFirebaseAuthWithCache();
  
  // Preload critical collections if Firebase is configured
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    // Don't block UI, load in background
    setTimeout(() => {
      void loadCollectionOnce('users');
      void loadCollectionOnce('settings');
    }, 1000);
  }
}
