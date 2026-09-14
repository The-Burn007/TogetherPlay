"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Globe,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect away from register
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage("Please enter your name or partner nickname.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      showToast({
        message: `Welcome to TogetherPlay, ${displayName}!`,
        variant: "success",
      });
      router.replace("/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setErrorMessage(msg);
      showToast({
        message: msg,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      showToast({
        message: "Account created with Google successfully.",
        variant: "success",
      });
      router.replace("/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google registration failed.";
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
        <LoadingSpinner size="lg" label="Preparing your sanctuary account..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-6 space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-raised border border-subtle-border shadow-md mb-2">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-player-one-ember -mr-1 shadow-sm" />
            <span className="w-3.5 h-3.5 rounded-full bg-player-two-sage -ml-1 shadow-sm" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
          Create Your Sanctuary
        </h1>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Set up your private space to play, communicate, and stay close across time zones.
        </p>
      </div>

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
        {/* Google Sign-Up */}
        <Button
          type="button"
          variant="surface"
          size="md"
          className="w-full justify-center font-medium border-subtle-border hover:border-shared-amber/40"
          onClick={handleGoogleSignUp}
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
        >
          <Globe className="w-4 h-4 mr-2 text-shared-amber" />
          Sign up with Google
        </Button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-subtle-border w-full" />
          <span className="bg-surface-raised px-3 text-[11px] font-mono uppercase tracking-wider text-on-surface-variant shrink-0">
            or with email
          </span>
          <div className="border-t border-subtle-border w-full" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Name or Nickname"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alex"
            disabled={isSubmitting || isGoogleSubmitting}
            iconPrefix={<User className="w-4 h-4" />}
            required
          />

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

          <Input
            label="Password (min 6 characters)"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

          <Input
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isSubmitting || isGoogleSubmitting}
            iconPrefix={<Lock className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            variant="amber"
            size="md"
            className="w-full justify-center"
            isLoading={isSubmitting}
            disabled={isGoogleSubmitting}
          >
            <span>Create Sanctuary Account</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </Card>

      <div className="text-center mt-6">
        <p className="text-xs text-on-surface-variant">
          Already registered?{" "}
          <Link
            href="/login"
            className="text-shared-amber font-semibold hover:underline"
          >
            Sign in to existing account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" label="Loading registration..." />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
