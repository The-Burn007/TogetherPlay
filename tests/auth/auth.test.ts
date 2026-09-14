import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mapAuthErrorMessage,
  formatAuthUser,
  FirebaseAuthService,
} from "@/lib/firebase/services/auth";
import type { User as FirebaseUser } from "firebase/auth";

// Mock Firebase client and auth methods
vi.mock("@/lib/firebase/client", () => ({
  auth: {
    currentUser: null,
  },
  db: {},
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({
    setCustomParameters: vi.fn(),
  })),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  onAuthStateChanged: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn().mockReturnValue({}),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

import * as firebaseAuth from "firebase/auth";

describe("Firebase Authentication Service", () => {
  let service: FirebaseAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FirebaseAuthService();
  });

  describe("1. register (signUpWithEmail)", () => {
    it("successfully creates a new user and updates profile name", async () => {
      const mockFirebaseUser = {
        uid: "user-reg-123",
        email: "alex@togetherplay.app",
        displayName: "Alex",
        photoURL: null,
        emailVerified: false,
      } as FirebaseUser;

      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValueOnce({
        user: mockFirebaseUser,
      } as any);

      vi.mocked(firebaseAuth.updateProfile).mockResolvedValueOnce(undefined);

      const user = await service.signUpWithEmail(
        "alex@togetherplay.app",
        "secretPass123!",
        "Alex"
      );

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "alex@togetherplay.app",
        "secretPass123!"
      );
      expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(
        mockFirebaseUser,
        { displayName: "Alex" }
      );
      expect(user.uid).toBe("user-reg-123");
      expect(user.email).toBe("alex@togetherplay.app");
    });
  });

  describe("2. login (signInWithEmail)", () => {
    it("successfully authenticates an existing user and returns AuthUser", async () => {
      const mockFirebaseUser = {
        uid: "user-login-456",
        email: "sam@togetherplay.app",
        displayName: "Sam",
        photoURL: null,
        emailVerified: true,
      } as FirebaseUser;

      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValueOnce({
        user: mockFirebaseUser,
      } as any);

      const user = await service.signInWithEmail("sam@togetherplay.app", "correctPassword");

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "sam@togetherplay.app",
        "correctPassword"
      );
      expect(user.uid).toBe("user-login-456");
      expect(user.displayName).toBe("Sam");
    });
  });

  describe("3. logout (signOut)", () => {
    it("invokes Firebase signOut to terminate the session", async () => {
      vi.mocked(firebaseAuth.signOut).mockResolvedValueOnce(undefined);

      await service.signOut();

      expect(firebaseAuth.signOut).toHaveBeenCalledWith(expect.anything());
    });
  });

  describe("4. password reset (sendPasswordReset)", () => {
    it("sends password reset email via Firebase SDK", async () => {
      vi.mocked(firebaseAuth.sendPasswordResetEmail).mockResolvedValueOnce(undefined);

      await service.sendPasswordReset("alex@togetherplay.app");

      expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        "alex@togetherplay.app"
      );
    });
  });

  describe("5. Google login (signInWithGoogle)", () => {
    it("initiates popup with GoogleAuthProvider and returns formatted user", async () => {
      const mockGoogleUser = {
        uid: "google-uid-789",
        email: "google.user@gmail.com",
        displayName: "Google Explorer",
        photoURL: "https://lh3.googleusercontent.com/photo",
        emailVerified: true,
      } as FirebaseUser;

      vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValueOnce({
        user: mockGoogleUser,
      } as any);

      const user = await service.signInWithGoogle();

      expect(firebaseAuth.signInWithPopup).toHaveBeenCalledTimes(1);
      expect(user.uid).toBe("google-uid-789");
      expect(user.email).toBe("google.user@gmail.com");
      expect(user.photoURL).toBe("https://lh3.googleusercontent.com/photo");
    });
  });

  describe("6. invalid credentials handling", () => {
    it("maps invalid-credential and wrong-password cleanly to a user-friendly message", () => {
      const errorWrongPass = { code: "auth/wrong-password" };
      const errorInvalidCred = { code: "auth/invalid-credential" };
      const errorUserNotFound = { code: "auth/user-not-found" };
      const errorWeakPass = { code: "auth/weak-password" };

      expect(mapAuthErrorMessage(errorWrongPass)).toBe(
        "Invalid email or password. Please verify your credentials."
      );
      expect(mapAuthErrorMessage(errorInvalidCred)).toBe(
        "Invalid email or password. Please verify your credentials."
      );
      expect(mapAuthErrorMessage(errorUserNotFound)).toBe(
        "No account found with this email address. Please register first."
      );
      expect(mapAuthErrorMessage(errorWeakPass)).toBe(
        "Password is too weak. Please use at least 6 characters."
      );
    });

    it("throws mapped user-friendly error when signInWithEmail fails", async () => {
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValueOnce({
        code: "auth/invalid-credential",
      });

      await expect(
        service.signInWithEmail("bad@example.com", "wrong")
      ).rejects.toThrow("Invalid email or password. Please verify your credentials.");
    });
  });

  describe("7. expired session handling", () => {
    it("handles transition from active session to null when token expires or is revoked", () => {
      let listenerCallback: (user: FirebaseUser | null) => void = () => {};
      vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementationOnce((_auth, callback: any) => {
        listenerCallback = callback;
        return vi.fn();
      });

      const userStates: any[] = [];
      service.subscribeToAuthState((user) => {
        userStates.push(user);
      });

      // Initially active session
      listenerCallback({
        uid: "user-session-1",
        email: "user@test.com",
        displayName: "User",
        photoURL: null,
        emailVerified: true,
      } as FirebaseUser);

      // Session expires / revoked (onAuthStateChanged fires with null)
      listenerCallback(null);

      expect(userStates).toHaveLength(2);
      expect(userStates[0]?.uid).toBe("user-session-1");
      expect(userStates[1]).toBeNull();
    });
  });

  describe("8. unauthenticated route access rules", () => {
    const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
    const PUBLIC_EXTRA_ROUTES = ["/design-system"];

    const isRouteProtected = (pathname: string): boolean => {
      const isPublic =
        PUBLIC_AUTH_ROUTES.includes(pathname) || PUBLIC_EXTRA_ROUTES.includes(pathname);
      return !isPublic;
    };

    it("correctly flags protected routes as requiring authentication", () => {
      expect(isRouteProtected("/home")).toBe(true);
      expect(isRouteProtected("/play")).toBe(true);
      expect(isRouteProtected("/play/find-it-first")).toBe(true);
      expect(isRouteProtected("/memories")).toBe(true);
      expect(isRouteProtected("/moments")).toBe(true);
      expect(isRouteProtected("/profile")).toBe(true);
      expect(isRouteProtected("/settings")).toBe(true);
      expect(isRouteProtected("/")).toBe(true);
    });

    it("correctly allows public access to auth pages", () => {
      expect(isRouteProtected("/login")).toBe(false);
      expect(isRouteProtected("/register")).toBe(false);
      expect(isRouteProtected("/forgot-password")).toBe(false);
      expect(isRouteProtected("/design-system")).toBe(false);
    });

    it("computes redirect target for unauthenticated users correctly", () => {
      const getUnauthenticatedRedirect = (pathname: string) => {
        return `/login?redirect=${encodeURIComponent(pathname)}`;
      };

      expect(getUnauthenticatedRedirect("/play/find-it-first")).toBe(
        "/login?redirect=%2Fplay%2Ffind-it-first"
      );
      expect(getUnauthenticatedRedirect("/memories")).toBe(
        "/login?redirect=%2Fmemories"
      );
    });
  });
});
