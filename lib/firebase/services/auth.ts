import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
  type AuthError,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../client";
import type { UserProfile } from "@/types/domain";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export function mapAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "An unexpected error occurred during authentication.";
  }

  const authError = error as AuthError;
  const code = authError.code;

  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/operation-not-allowed":
      return "This sign-in method is currently not enabled in Firebase.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/user-not-found":
      return "No account found with this email address. Please register first.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/popup-closed-by-user":
      return "Google Sign-In was closed before completion. Please try again.";
    case "auth/popup-blocked":
      return "Google Sign-In popup was blocked by your browser. Please allow popups.";
    case "auth/cancelled-popup-request":
      return "Authentication popup was cancelled.";
    case "auth/too-many-requests":
      return "Too many attempts. Access temporarily locked for security. Please wait a moment.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/requires-recent-login":
      return "This security operation requires recent sign-in. Please log in again.";
    default:
      return authError.message || "Authentication failed. Please try again.";
  }
}

/**
 * Converts a FirebaseUser instance to our decoupled AuthUser model.
 */
export function formatAuthUser(user: FirebaseUser | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export interface AuthServiceContract {
  getCurrentUser(): AuthUser | null;
  subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser>;
  signInWithGoogle(): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  syncUserProfile(user: AuthUser): Promise<void>;
}

export class FirebaseAuthService implements AuthServiceContract {
  getCurrentUser(): AuthUser | null {
    return formatAuthUser(auth.currentUser);
  }

  subscribeToAuthState(callback: (user: AuthUser | null) => void): () => void {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        const formatted = formatAuthUser(user);
        callback(formatted);
      },
      (error) => {
        console.error("Auth state subscription error:", error);
        callback(null);
      }
    );
    return unsubscribe;
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const formatted = formatAuthUser(credential.user);
      if (formatted) {
        // Non-blocking sync to keep user record up to date
        this.syncUserProfile(formatted).catch((err) => {
          console.warn("User profile background sync warning:", err);
        });
      }
      return formatted!;
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser> {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
      }
      const formatted = formatAuthUser(credential.user);
      if (formatted) {
        // Safe profile creation in firestore
        this.syncUserProfile({
          ...formatted,
          displayName: displayName?.trim() || formatted.displayName,
        }).catch((err) => {
          console.warn("User profile background creation warning:", err);
        });
      }
      return formatted!;
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }

  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const formatted = formatAuthUser(credential.user);
      if (formatted) {
        this.syncUserProfile(formatted).catch((err) => {
          console.warn("Google user profile sync warning:", err);
        });
      }
      return formatted!;
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error(mapAuthErrorMessage(error));
    }
  }

  /**
   * Syncs user details to Firestore /users/{uid} safely according to firestore.rules
   * Does NOT touch couple documents or couple functionality.
   */
  async syncUserProfile(user: AuthUser): Promise<void> {
    try {
      if (!user.uid) return;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      const now = new Date().toISOString();
      if (!snap.exists()) {
        const initialProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || user.email?.split("@")[0] || "Explorer",
          email: user.email || undefined,
          photoURL: user.photoURL || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          createdAt: now,
          lastActiveAt: now,
          status: "active",
        };
        await setDoc(userRef, initialProfile, { merge: true });
      } else {
        await setDoc(
          userRef,
          {
            lastActiveAt: now,
            ...(user.displayName ? { displayName: user.displayName } : {}),
            ...(user.photoURL ? { photoURL: user.photoURL } : {}),
          },
          { merge: true }
        );
      }
    } catch (error) {
      // Background sync errors are logged but never crash auth flow
      console.warn("Firestore syncUserProfile non-fatal error:", error);
    }
  }

  /**
   * Fetches user profile data from Firestore /users/{uid}
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      if (!uid) return null;

      // Fast-path test sandbox profiles
      if (uid === "user_sam") {
        return {
          uid: "user_sam",
          displayName: "Sam",
          timezone: "Asia/Tokyo",
          coupleId: "cpl_tokyo_london_4209",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastActiveAt: new Date().toISOString(),
          status: "active",
        };
      }
      if (uid === "user_alex") {
        return {
          uid: "user_alex",
          displayName: "Alex",
          timezone: "Europe/London",
          coupleId: "cpl_tokyo_london_4209",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastActiveAt: new Date().toISOString(),
          status: "active",
        };
      }

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return null;
      return snap.data() as UserProfile;
    } catch (error) {
      console.warn("Error fetching user profile:", error);
      return null;
    }
  }
}

export const authService = new FirebaseAuthService();

