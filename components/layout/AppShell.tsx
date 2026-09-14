"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DesktopRail } from "./DesktopRail";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { NotificationDrawer } from "./NotificationDrawer";
import { PageTransition } from "./PageTransition";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PUBLIC_EXTRA_ROUTES = ["/design-system", "/onboarding/invite"];

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const isAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);
  const isPublicRoute = isAuthRoute || PUBLIC_EXTRA_ROUTES.includes(pathname);
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (isLoading) return;

    // 1. If user is unauthenticated and attempting to access a protected route
    if (!isAuthenticated && !isPublicRoute) {
      const redirectParam =
        pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirectParam}`);
    }

    // 2. If user is authenticated and attempting to access login/register/forgot-password
    if (isAuthenticated && isAuthRoute) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, isPublicRoute, isAuthRoute, pathname, router]);

  // Loading state while Firebase restores the auth session from IndexedDB/cookies
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-surface-deep flex flex-col items-center justify-center p-6 space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-raised border border-subtle-border shadow-md">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-player-one-ember -mr-1 animate-pulse" />
            <span className="w-3.5 h-3.5 rounded-full bg-player-two-sage -ml-1 animate-pulse" />
          </div>
        </div>
        <LoadingSpinner size="lg" label="Entering sanctuary..." />
      </div>
    );
  }

  // Auth pages view: clean centered card layout without authenticated sidebars and headers
  if (isAuthRoute) {
    if (isAuthenticated) {
      return (
        <div className="min-h-screen w-full bg-surface-deep flex items-center justify-center p-6">
          <LoadingSpinner size="md" label="Redirecting to your sanctuary..." />
        </div>
      );
    }
    return (
      <div className="min-h-screen w-full bg-surface-deep text-on-surface flex flex-col justify-center items-center py-6 px-4">
        <PageTransition>{children}</PageTransition>
      </div>
    );
  }

  // Protected route when unauthenticated: show loading/redirecting indicator
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen w-full bg-surface-deep flex flex-col items-center justify-center p-6 space-y-3">
        <LoadingSpinner size="md" label="Redirecting to sanctuary sign in..." />
      </div>
    );
  }

  // Focused, intimate couple onboarding ritual layout
  if (isOnboardingRoute) {
    return (
      <div className="relative min-h-screen w-full bg-surface-deep text-on-surface flex flex-col justify-center items-center py-8 px-4 sm:px-6">
        <main className="w-full max-w-xl">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    );
  }

  // Authenticated Application Shell
  return (
    <div className="relative min-h-screen w-full bg-surface-deep text-on-surface flex">
      {/* 1. Desktop Refined Side Rail */}
      <DesktopRail
        onOpenNotifications={() => setIsNotificationOpen(true)}
        unreadCount={2}
      />

      {/* 2. Main Viewport & Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200">
        {/* Top Header */}
        <Header
          onOpenNotifications={() => setIsNotificationOpen(true)}
          unreadCount={2}
        />

        {/* Responsive Content Area with Smooth Page Transitions */}
        <main
          id="main-content"
          className="flex-1 flex flex-col w-full md:pl-20 lg:pl-60"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation */}
      <BottomNav />

      {/* 4. Private Couple Whispers & Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
};
