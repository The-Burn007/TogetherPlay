import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider } from "@/lib/auth/AuthContext";

export const metadata: Metadata = {
  title: "TogetherPlay",
  description: "Multiplayer relationship game room for couples living apart.",
  openGraph: {
    title: "TogetherPlay",
    description: "Multiplayer relationship game room for couples living apart.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
      </head>
      <body className="bg-surface-deep text-on-surface antialiased selection:bg-shared-amber/30 selection:text-shared-amber min-h-screen">
        <ToastProvider>
          <ErrorBoundary>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  );
}
