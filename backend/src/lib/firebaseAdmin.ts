import admin from 'firebase-admin';

let app: admin.app.App | null = null;

function initFirebaseAdmin() {
  if (app) return app;

  // Prefer explicit service account JSON via env for non-GCP deployments.
  // Expected format: JSON stringified service account.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson && serviceAccountJson.trim().length > 0) {
    const credential = admin.credential.cert(JSON.parse(serviceAccountJson));
    app = admin.initializeApp({ credential });
    return app;
  }

  // Fallback to application default credentials (e.g. if running in Firebase/GCP or with GOOGLE_APPLICATION_CREDENTIALS).
  app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return app;
}

export function getAdminApp() {
  return initFirebaseAdmin();
}

export function getAdminAuth() {
  initFirebaseAdmin();
  return admin.auth();
}

export function getAdminFirestore() {
  initFirebaseAdmin();
  return admin.firestore();
}

export type FirebaseRoleDoc = {
  name?: string;
  permissions?: string[];
};

export type FirebaseUserDoc = {
  email?: string;
  displayName?: string;
  roleId?: string;
  active?: boolean;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  lastLoginAt?: admin.firestore.Timestamp;
};
