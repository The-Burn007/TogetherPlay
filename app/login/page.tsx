"use client";

import React, { useState, useEffect, Suspense } from "react";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail, signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const redirectUrl = searchParams.get("redirect") || "/home";
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error/30 flex items-start gap-2.5 text-xs text-status-error"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
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
