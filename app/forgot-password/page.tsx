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
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

function ForgotPasswordForm() {
  const router = useRouter();
  const { sendPasswordReset, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your account email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setIsSubmitted(true);
      showToast({
        message: "Password recovery email dispatched.",
        variant: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Password reset failed.";
      setErrorMessage(msg);
      showToast({
        message: msg,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" label="Checking sanctuary status..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-6 space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-raised border border-subtle-border shadow-md mb-2">
          <KeyRound className="w-6 h-6 text-shared-amber" />
        </div>
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
          Reset Password
        </h1>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Enter your registered email address and we&apos;ll send you instructions to regain access to your sanctuary.
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
        {isSubmitted ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-player-two-sage/20 border border-player-two-sage/40 flex items-center justify-center text-player-two-sage">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-on-surface">
                Recovery Link Dispatched
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                If an account matches <span className="text-canvas-cream font-mono font-medium">{email}</span>, a secure password reset link has been sent. Please check your inbox and spam folder.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-lg bg-shared-amber hover:bg-shared-amber-hover text-surface-deep font-semibold text-sm transition-colors text-center shadow-md"
              >
                Return to Sign In
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                }}
                className="text-xs text-on-surface-variant hover:text-on-surface underline font-mono py-1"
              >
                Did not receive? Try another email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Account Email Address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              iconPrefix={<Mail className="w-4 h-4" />}
              helperText="We will send a cryptographically signed reset token via Firebase."
              required
            />

            <Button
              type="submit"
              variant="amber"
              size="md"
              className="w-full justify-center"
              isLoading={isSubmitting}
            >
              Send Recovery Link
            </Button>
          </form>
        )}
      </Card>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" label="Loading recovery..." />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
