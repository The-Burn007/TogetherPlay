import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider } from "@/lib/auth/AuthContext";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TogetherPlay",
  description: "Private digital space for two people in a long-distance relationship.",
  openGraph: {
    title: "TogetherPlay",
    description: "Private digital space for two people in a long-distance relationship.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${ibmPlexSans.variable}`}
    >
      <body className="bg-background text-text-primary font-sans antialiased selection:bg-brand/30 selection:text-brand min-h-screen">
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

