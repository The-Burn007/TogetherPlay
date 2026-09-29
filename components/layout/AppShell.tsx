"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { NotificationDrawer } from "./NotificationDrawer";
import { PageTransition } from "./PageTransition";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useNotifications } from "@/lib/presence/useNotifications";

const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PUBLIC_EXTRA_ROUTES = ["/design-system", "/onboarding/invite"];

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, isTestMode, user, signInAsTestUser, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const isAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);
  const isPublicRoute = isAuthRoute || PUBLIC_EXTRA_ROUTES.includes(pathname);
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (isLoading) return;

    if (
      process.env.NODE_ENV !== "production" &&
      !isAuthenticated &&
      typeof window !== "undefined" &&
      window.location.search.includes("bypass=true")
    ) {
      signInAsTestUser("alex");
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      const redirectParam =
        pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirectParam}`);
    }

    if (isAuthenticated && isAuthRoute) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, isPublicRoute, isAuthRoute, pathname, router, signInAsTestUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full tp-environment tp-fine-grid flex flex-col items-center justify-center p-6 space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border shadow-elevation-md">
          <div className="relative flex items-center justify-center">
            <span className="w-4 h-4 rounded-full bg-player-one-ember -mr-1.5 shadow-sm" />
            <span className="w-4 h-4 rounded-full bg-player-two-sage -ml-1.5 shadow-sm" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
          </div>
        </div>
        <LoadingSpinner size="lg" label="Entering sanctuary..." />
      </div>
    );
  }

  if (isAuthRoute) {
    if (isAuthenticated) {
      return (
        <div className="min-h-screen w-full tp-environment tp-fine-grid flex items-center justify-center p-6">
          <LoadingSpinner size="md" label="Redirecting to your sanctuary..." />
        </div>
      );
    }
    return (
      <div className="min-h-screen w-full tp-environment tp-fine-grid text-text-primary flex flex-col justify-center items-center py-6 px-4">
        <PageTransition>{children}</PageTransition>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen w-full tp-environment tp-fine-grid flex flex-col items-center justify-center p-6 space-y-3">
        <LoadingSpinner size="md" label="Redirecting to sanctuary sign in..." />
      </div>
    );
  }

  if (isOnboardingRoute) {
    return (
      <div className="relative min-h-screen w-full tp-environment tp-fine-grid text-text-primary flex flex-col justify-center items-center py-8 px-4 sm:px-6">
        <main className="w-full max-w-xl">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full tp-environment tp-fine-grid text-text-primary flex flex-col selection:bg-brand/30 selection:text-brand">
      {/* Test Mode Sandbox Ribbon */}
      {isTestMode && process.env.NODE_ENV !== "production" && (
        <div className="bg-surface/90 border-b border-warning/20 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary z-30 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span className="font-mono font-semibold text-warning">TEST SANDBOX</span>
            <span className="text-text-muted">·</span>
            <span>
              Partner:{" "}
              <strong className="text-text-primary">
                {user?.displayName || "Alex"}
              </strong>{" "}
              <span className="text-text-muted font-mono text-[11px]">
                ({user?.uid === "user_sam" ? "Tokyo" : "London"})
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() =>
                signInAsTestUser(user?.uid === "user_alex" ? "sam" : "alex")
              }
              className="text-brand hover:underline font-mono text-[11px] cursor-pointer"
            >
              Switch to {user?.uid === "user_alex" ? "Sam (P2)" : "Alex (P1)"}
            </button>
            <span className="text-text-muted">|</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-text-muted hover:text-text-primary text-[11px] cursor-pointer"
            >
              Exit Sandbox
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {/* Unified Top Navigation Bar */}
        <Header
          onOpenNotifications={() => setIsNotificationOpen(true)}
          unreadCount={unreadCount}
        />

        {/* Main Viewport & Content Area */}
        <main
          id="main-content"
          className="flex-1 flex flex-col w-full pt-4 pb-24 md:pb-12"
        >
          <PageTransition>{children}</PageTransition>
        </main>

        {/* Mobile Bottom Dock (under 15% mobile viewport cap) */}
        <BottomNav />

        {/* Notifications Drawer */}
        <NotificationDrawer
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
        />
      </div>
    </div>
  );
};
