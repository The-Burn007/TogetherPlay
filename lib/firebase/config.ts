/**
 * TogetherPlay Firebase Client Configuration
 * 
 * Safe client-side environment variable loader.
 * Reads public NEXT_PUBLIC_FIREBASE_* variables without leaking server secrets.
 */

import firebaseAppletConfig from "@/firebase-applet-config.json";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
  databaseURL?: string;
}

export const firebaseClientConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseAppletConfig.appId || "",
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || undefined,
};

/**
 * Returns true if real Firebase project environment variables are populated.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseClientConfig.apiKey &&
    firebaseClientConfig.apiKey !== "AIzaSyDummyKeyForInitialization" &&
    firebaseClientConfig.projectId
  );
}
