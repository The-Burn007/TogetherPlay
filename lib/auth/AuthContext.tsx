"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService, type AuthUser } from "@/lib/firebase/services/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTestMode: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsTestUser: (preset?: "alex" | "sam" | "guest", customName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);

  // Subscribe to Firebase Auth state on mount (detects session from IndexedDB/localStorage automatically)
  useEffect(() => {
    // 1. Check for stored test user bypass in localStorage (development / preview only)
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      try {
        const savedTestUser = localStorage.getItem("togetherplay_test_user");
        if (savedTestUser) {
          const parsed = JSON.parse(savedTestUser);
          if (parsed?.uid) {
            setUser(parsed);
            setIsTestMode(true);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn("Could not read test user from localStorage", err);
      }
    }

    // 2. Subscribe to Firebase Auth state
    const unsubscribe = authService.subscribeToAuthState((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsTestMode(false);
        setIsLoading(false);
      } else {
        // Fallback to test user if present in storage (development / preview only)
        if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
          const savedTestUser = localStorage.getItem("togetherplay_test_user");
          if (savedTestUser) {
            try {
              const parsed = JSON.parse(savedTestUser);
              if (parsed?.uid) {
                setUser(parsed);
                setIsTestMode(true);
                setIsLoading(false);
                return;
              }
            } catch {
              // ignore
            }
          }
        }
        setUser(null);
        setIsTestMode(false);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signInAsTestUser = useCallback(
    async (preset: "alex" | "sam" | "guest" = "alex", customName?: string) => {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Test mode sandbox is disabled in production.");
      }
      setIsLoading(true);
      try {
        let testUser: AuthUser;
        if (preset === "sam") {
          testUser = {
            uid: "user_sam",
            email: "sam@togetherplay.app",
            displayName: customName || "Sam",
            photoURL: null,
            emailVerified: true,
          };
        } else if (preset === "guest") {
          testUser = {
            uid: "user_guest_" + Date.now().toString(36),
            email: "guest@togetherplay.app",
            displayName: customName || "Guest Explorer",
            photoURL: null,
            emailVerified: true,
          };
        } else {
          testUser = {
            uid: "user_alex",
            email: "alex@togetherplay.app",
            displayName: customName || "Alex",
            photoURL: null,
            emailVerified: true,
          };
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("togetherplay_test_user", JSON.stringify(testUser));
        }
        setUser(testUser);
        setIsTestMode(true);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.signInWithEmail(email, password);
      setUser(loggedUser);
      setIsTestMode(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("togetherplay_test_user");
      }
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
      console.warn("Firebase Auth sign in failed, fallback to local test session in dev:", err);
      // Fallback in case Firebase Auth provider is disabled in dev sandbox
      const fallbackUser: AuthUser = {
        uid: "user_" + (email.includes("sam") ? "sam" : "alex"),
        email: email.trim(),
        displayName: email.split("@")[0] || "Explorer",
        photoURL: null,
        emailVerified: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("togetherplay_test_user", JSON.stringify(fallbackUser));
      }
      setUser(fallbackUser);
      setIsTestMode(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setIsLoading(true);
      try {
        const registeredUser = await authService.signUpWithEmail(email, password, displayName);
        setUser(registeredUser);
        setIsTestMode(false);
        if (typeof window !== "undefined") {
          localStorage.removeItem("togetherplay_test_user");
        }
      } catch (err: unknown) {
        if (process.env.NODE_ENV === "production") {
          throw err;
        }
        console.warn("Firebase Auth sign up failed, fallback to local test session in dev:", err);
        // Fallback so signup in dev sandbox doesn't block local testing
        const fallbackUser: AuthUser = {
          uid: "user_" + Math.random().toString(36).substring(2, 9),
          email: email.trim(),
          displayName: displayName?.trim() || email.split("@")[0] || "Explorer",
          photoURL: null,
          emailVerified: true,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("togetherplay_test_user", JSON.stringify(fallbackUser));
        }
        setUser(fallbackUser);
        setIsTestMode(true);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const googleUser = await authService.signInWithGoogle();
      setUser(googleUser);
      setIsTestMode(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("togetherplay_test_user");
      }
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
      console.warn("Google Sign-In failed, fallback to test user in dev:", err);
      const fallbackUser: AuthUser = {
        uid: "user_alex",
        email: "alex@togetherplay.app",
        displayName: "Alex",
        photoURL: null,
        emailVerified: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("togetherplay_test_user", JSON.stringify(fallbackUser));
      }
      setUser(fallbackUser);
      setIsTestMode(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("togetherplay_test_user");
      }
      setIsTestMode(false);
      await authService.signOut().catch(() => {});
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await authService.sendPasswordReset(email).catch(() => {});
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isTestMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInAsTestUser,
    signOut,
    sendPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
