"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { motion } from "motion/react";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Globe,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, signInAsTestUser, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isBypassing, setIsBypassing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect away from register
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleBypassTestUser = useCallback(
    async (preset: "alex" | "sam" = "alex") => {
      setIsBypassing(true);
      try {
        await signInAsTestUser(preset, displayName.trim() || undefined);
        showToast({
          message: `Entered test mode as ${preset === "alex" ? (displayName.trim() || "Alex") : "Sam"}.`,
          variant: "success",
        });
        router.replace("/home");
      } catch {
        showToast({
          message: "Failed to initialize test mode.",
          variant: "error",
        });
      } finally {
        setIsBypassing(false);
      }
    },
    [signInAsTestUser, displayName, showToast, router]
  );

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto py-8 sm:py-12 px-4 sm:px-6"
    >
      <div className="text-center mb-8 space-y-3">
        {/* Intimate Dual Presence Emblem */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border shadow-elevation-sm mb-1">
          <div className="relative flex items-center justify-center">
            <span className="w-4 h-4 rounded-full bg-player-one-ember -mr-1.5 shadow-sm ring-2 ring-surface" />
            <span className="w-4 h-4 rounded-full bg-player-two-sage -ml-1.5 shadow-sm ring-2 ring-surface" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
            Create Sanctuary
          </h1>
          <p className="text-xs text-text-secondary max-w-xs mx-auto leading-relaxed">
            Dedicate your private space to play, stay present, and build memories across any time zone.
          </p>
        </div>
      </div>

      {/* Quick Test / QA Bypass Sandbox (Development only) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mb-5 p-4 rounded-2xl bg-surface border border-border text-left space-y-3 shadow-elevation-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-semibold text-brand tracking-wider uppercase font-mono">
                Development Sandbox
              </span>
            </div>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              Bypass Auth
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Skip registration and test the app immediately as either partner to explore games, video, and presence rituals.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Button
              type="button"
              variant="ember"
              size="sm"
              onClick={() => handleBypassTestUser("alex")}
              isLoading={isBypassing}
              className="w-full text-xs justify-center font-medium"
            >
              <span>Test as Alex (P1)</span>
            </Button>
            <Button
              type="button"
              variant="sage"
              size="sm"
              onClick={() => handleBypassTestUser("sam")}
              isLoading={isBypassing}
              className="w-full text-xs justify-center font-medium"
            >
              <span>Test as Sam (P2)</span>
            </Button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-danger/10 border border-danger/30 space-y-2 text-xs text-danger shadow-sm"
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
                className="text-brand underline font-medium hover:text-brand-hover text-xs cursor-pointer"
              >
                Click here to bypass signup and enter in Test Mode instead →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 space-y-5 shadow-elevation-md">
        {/* Google Sign-Up */}
        <Button
          type="button"
          variant="surface"
          size="md"
          className="w-full justify-center font-medium border-border hover:border-brand/40"
          onClick={handleGoogleSignUp}
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
        >
          <Globe className="w-4 h-4 mr-2 text-brand" />
          <span>Sign up with Google</span>
        </Button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-border-subtle w-full" />
          <span className="bg-surface px-3 text-[10px] font-mono uppercase tracking-wider text-text-muted shrink-0">
            or with email
          </span>
          <div className="border-t border-border-subtle w-full" />
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
                className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
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
            variant="brand"
            size="lg"
            className="w-full justify-center font-semibold"
            isLoading={isSubmitting}
            disabled={isGoogleSubmitting}
          >
            <span>Create Sanctuary Account</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>
      </div>

      <div className="text-center mt-6">
        <p className="text-xs text-text-secondary">
          Already registered?{" "}
          <Link
            href="/login"
            className="text-brand font-semibold hover:underline"
          >
            Sign in to existing account
          </Link>
        </p>
      </div>
    </motion.div>
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
