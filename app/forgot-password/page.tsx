"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { motion } from "motion/react";
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto py-8 sm:py-12 px-4 sm:px-6"
    >
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border shadow-elevation-sm mb-1 text-brand">
          <KeyRound className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs text-text-secondary max-w-xs mx-auto leading-relaxed">
            Enter your registered email address and we&apos;ll send you instructions to regain access to your sanctuary.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-2.5 text-xs text-danger shadow-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 space-y-5 shadow-elevation-md">
        {isSubmitted ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">
                Recovery Link Dispatched
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                If an account matches <span className="text-brand font-mono font-medium">{email}</span>, a secure password reset link has been sent. Please check your inbox and spam folder.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-text-on-mint font-semibold text-sm transition-colors text-center shadow-sm"
              >
                Return to Sign In
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                }}
                className="text-xs text-text-muted hover:text-text-primary underline font-mono py-1 cursor-pointer"
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
              helperText="We will send a secure link to reset your account password."
              required
            />

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full justify-center font-semibold"
              isLoading={isSubmitting}
            >
              Send Recovery Link
            </Button>
          </form>
        )}
      </div>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </motion.div>
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
