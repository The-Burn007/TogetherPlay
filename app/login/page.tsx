"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Globe,
  ArrowRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

function sanitizeRedirectUrl(url: string | null): string {
  if (!url || typeof url !== "string") return "/home";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  return "/home";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail, signInWithGoogle, signInAsTestUser, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect"));
  const reason = searchParams.get("reason");
  const autoBypass = searchParams.get("bypass") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isBypassing, setIsBypassing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBypassTestUser = useCallback(
    async (preset: "alex" | "sam" = "alex") => {
      setIsBypassing(true);
      try {
        await signInAsTestUser(preset);
        showToast({
          message: `Entered test mode as ${preset === "alex" ? "Alex (London)" : "Sam (Tokyo)"}.`,
          variant: "success",
        });
        router.replace(redirectUrl);
      } catch {
        showToast({
          message: "Failed to initialize test mode.",
          variant: "error",
        });
      } finally {
        setIsBypassing(false);
      }
    },
    [signInAsTestUser, showToast, router, redirectUrl]
  );

  // Auto-bypass if requested via ?bypass=true query param
  useEffect(() => {
    if (autoBypass && !isAuthenticated) {
      handleBypassTestUser("alex");
    }
  }, [autoBypass, isAuthenticated, handleBypassTestUser]);

  // If already logged in, redirect away from login
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      showToast({
        message: "Welcome back to your sanctuary room.",
        variant: "success",
      });
      router.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setErrorMessage(msg);
      showToast({
        message: msg,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      showToast({
        message: "Signed in with Google successfully.",
        variant: "success",
      });
      router.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google Sign-In failed.";
      setErrorMessage(msg);
      showToast({
        message: msg,
        variant: "error",
      });
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" label="Checking sanctuary credentials..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-6 space-y-2">
        {/* Intimate Brand Mark */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-raised border border-subtle-border shadow-md mb-2">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-player-one-ember -mr-1 shadow-sm" />
            <span className="w-3.5 h-3.5 rounded-full bg-player-two-sage -ml-1 shadow-sm" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
          Welcome to TogetherPlay
        </h1>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Your private multiplayer room for presence, games, and intimate rituals across distance.
        </p>
      </div>

      {reason === "expired" && (
        <div className="mb-4 p-3 rounded-lg bg-surface-raised border border-border-amber/40 flex items-start gap-2.5 text-xs text-on-surface">
          <Sparkles className="w-4 h-4 text-shared-amber shrink-0 mt-0.5" />
          <p>Your session has ended for security. Please sign in to reconnect.</p>
        </div>
      )}

      {/* Quick Test / QA Bypass Banner (Development only) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-semibold text-amber-400 tracking-wide uppercase font-mono">
                Quick Test Sandbox
              </span>
            </div>
            <span className="text-[11px] text-amber-300/80 font-mono">
              Bypass Auth
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Skip login and immediately enter the app as either partner to test games, video, and presence rituals.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="amber"
              size="sm"
              onClick={() => handleBypassTestUser("alex")}
              isLoading={isBypassing}
              className="w-full text-xs justify-center font-medium"
            >
              <span>Test as Alex (P1)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleBypassTestUser("sam")}
              isLoading={isBypassing}
              className="w-full text-xs justify-center font-medium border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30"
            >
              <span>Test as Sam (P2)</span>
            </Button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error/30 space-y-2 text-xs text-status-error"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleBypassTestUser("alex")}
                className="text-amber-400 underline font-medium hover:text-amber-300 text-xs cursor-pointer"
              >
                Click here to bypass login and enter in Test Mode instead →
              </button>
            </div>
          )}
        </div>
      )}

      <Card variant="raised" className="p-6 space-y-5">
        {/* Google Sign-In */}
        <Button
          type="button"
          variant="surface"
          size="md"
          className="w-full justify-center font-medium border-subtle-border hover:border-shared-amber/40"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
        >
          <Globe className="w-4 h-4 mr-2 text-shared-amber" />
          Continue with Google
        </Button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-subtle-border w-full" />
          <span className="bg-surface-raised px-3 text-[11px] font-mono uppercase tracking-wider text-on-surface-variant shrink-0">
            or sign in with email
          </span>
          <div className="border-t border-subtle-border w-full" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isSubmitting || isGoogleSubmitting}
            iconPrefix={<Mail className="w-4 h-4" />}
            required
          />

          <div className="space-y-1">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting || isGoogleSubmitting}
              iconPrefix={<Lock className="w-4 h-4" />}
              iconSuffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:text-on-surface transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
              required
            />
            <div className="flex justify-end pt-1">
              <Link
                href="/forgot-password"
                className="text-[11px] text-shared-amber hover:underline font-mono"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="amber"
            size="md"
            className="w-full justify-center"
            isLoading={isSubmitting}
            disabled={isGoogleSubmitting}
          >
            <span>Enter Sanctuary</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </Card>

      <div className="text-center mt-6">
        <p className="text-xs text-on-surface-variant">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/register"
            className="text-shared-amber font-semibold hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" label="Loading sanctuary login..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
