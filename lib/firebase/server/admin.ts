/**
 * Firebase Admin SDK Server-Only Module
 *
 * ARCHITECTURE PRINCIPLE:
 * This module is STRICTLY server-only. It must never be bundled or sent to the client browser.
 * Provides singleton access to Firebase Admin App and Auth for cryptographically verifying ID tokens.
 */

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getAppCheck, type AppCheck } from "firebase-admin/app-check";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getDatabase, type Database, getDatabaseWithUrl } from "firebase-admin/database";
import { getStorage, type Storage } from "firebase-admin/storage";
import firebaseAppletConfig from "@/firebase-applet-config.json";

if (typeof window !== "undefined") {
  throw new Error("Security Violation: Firebase Admin SDK cannot be loaded in client browser bundle.");
}

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminAppCheck: AppCheck | null = null;
let adminFirestore: Firestore | null = null;
let adminDatabase: Database | null = null;
let adminStorage: Storage | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    firebaseAppletConfig.projectId ||
    "rational-drake-mlcf1";

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    ((firebaseAppletConfig as unknown as Record<string, unknown>).databaseURL as string | undefined) ||
    `https://${projectId}-default-rtdb.firebaseio.com`;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket ||
    `${projectId}.firebasestorage.app`;

  const appOptions = {
    projectId,
    databaseURL,
    storageBucket,
  };

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        ...appOptions,
        credential: cert(parsed),
      });
      return adminApp;
    } catch (err) {
      console.error("[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    }
  }

  if (clientEmail && privateKey && privateKey.includes("-----BEGIN")) {
    try {
      adminApp = initializeApp({
        ...appOptions,
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      return adminApp;
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("[FirebaseAdmin] Failed to initialize with clientEmail/privateKey:", err);
      }
    }
  }

  // Application Default Credentials (standard on Cloud Run / App Hosting / GCP)
  adminApp = initializeApp(appOptions);
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminAppCheck(): AppCheck {
  if (!adminAppCheck) {
    adminAppCheck = getAppCheck(getAdminApp());
  }
  return adminAppCheck;
}

/**
 * Singleton access to Firebase Admin Firestore.
 * Preserves access to the named database (e.g. ai-studio-togetherplay-d6bdf06e-a587-4086-bba7-ea0cae100115).
 */
export function getAdminFirestore(databaseId?: string): Firestore {
  if (adminFirestore) return adminFirestore;
  const app = getAdminApp();
  const dbId =
    databaseId ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    firebaseAppletConfig.firestoreDatabaseId;

  if (dbId && dbId !== "(default)") {
    adminFirestore = getFirestore(app, dbId);
  } else {
    adminFirestore = getFirestore(app);
  }
  return adminFirestore;
}

/**
 * Singleton access to Firebase Admin Realtime Database.
 */
export function getAdminDatabase(url?: string): Database {
  if (adminDatabase) return adminDatabase;
  const app = getAdminApp();
  if (url) {
    adminDatabase = getDatabaseWithUrl(url, app);
  } else {
    adminDatabase = getDatabase(app);
  }
  return adminDatabase;
}

/**
 * Singleton access to Firebase Admin Storage.
 */
export function getAdminStorage(): Storage {
  if (!adminStorage) {
    adminStorage = getStorage(getAdminApp());
  }
  return adminStorage;
}

/**
 * Checks if Firebase Admin is configured with credentials or project identifier.
 */
export function isAdminFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_PROJECT_ID ||
    firebaseAppletConfig.projectId
  );
}

export function setAdminAppCheck(customAppCheck: AppCheck | null): void {
  adminAppCheck = customAppCheck;
}

export function setAdminAuth(customAuth: Auth | null): void {
  adminAuth = customAuth;
}

export function setAdminFirestore(customFirestore: Firestore | null): void {
  adminFirestore = customFirestore;
}

export function setAdminDatabase(customDatabase: Database | null): void {
  adminDatabase = customDatabase;
}

export function setAdminStorage(customStorage: Storage | null): void {
  adminStorage = customStorage;
}

export function resetAdminInstancesForTesting(): void {
  adminApp = null;
  adminAuth = null;
  adminAppCheck = null;
  adminFirestore = null;
  adminDatabase = null;
  adminStorage = null;
}

/**
 * Synchronizes authoritative couple membership to Firebase Realtime Database.
 * RTDB security rules check root.child('couples').child(coupleId) for presence authorization.
 * Since RTDB /couples has .write: false for clients, this server-only write establishes
 * the non-forgeable ground truth of couple membership.
 */
export async function seedAuthoritativeCoupleMembership(
  coupleId: string,
  memberIds: string[]
): Promise<void> {
  try {
    const db = getAdminDatabase();
    const membersMap = memberIds.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});

    await db.ref(`couples/${coupleId}`).set({
      coupleId,
      memberIds,
      members: membersMap,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[RTDB] Failed to seed authoritative couple membership for ${coupleId}:`, err);
  }
}


