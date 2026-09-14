import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseClientConfig } from "./config";

/**
 * Singleton Firebase App instance with lazy, safe initialization.
 * Prevents multiple instances and avoids SSR module crashes when env vars are pending.
 */
function initializeFirebase(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseClientConfig);
}

export const app = initializeFirebase();
export const auth: Auth = getAuth(app);
export const db: Firestore = firebaseClientConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseClientConfig.firestoreDatabaseId)
  : getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const storage: FirebaseStorage = getStorage(app);

// Typed Lazy Getters for SSR safety and test mocking
export function getClientApp(): FirebaseApp {
  return app;
}

export function getClientAuth(): Auth {
  return auth;
}

export function getClientFirestore(): Firestore {
  return db;
}

export function getClientDatabase(): Database {
  return rtdb;
}

export function getClientStorage(): FirebaseStorage {
  return storage;
}
