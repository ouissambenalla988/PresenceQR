"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";

import { LoadingButton } from "@/components/loading-button";
import { StatusAlert } from "@/components/status-alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthStatus = "idle" | "loading" | "success" | "error";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string | null>(null);

  const isSignIn = mode === "sign-in";
  const isLoading = status === "loading";

  async function handleSubmit(formData: FormData) {
    if (isLoading) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    setStepMessage(isSignIn ? "Signing in..." : "Creating your account...");

    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const supabase = createClient();

    let redirectTo = searchParams.get("redirectedFrom") ?? "/dashboard";

    if (isSignIn) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setStatus("error");
        setStepMessage(null);
        setErrorMessage(getFriendlyAuthError(result.error.message));
        return;
      }
      setStepMessage("Redirecting...");
    } else {
      // Sign-up: verify SchoolApp + create Supabase account server-side (no rate limit)
      setStepMessage("Verifying your SchoolApp account...");
      const signup = await serverSideSignup(email, password);
      if (!signup.success) {
        setStatus("error");
        setStepMessage(null);
        setErrorMessage(signup.message);
        return;
      }

      // Establish browser session by signing in after server created the account
      setStepMessage("Setting up your session...");
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setStatus("error");
        setStepMessage(null);
        setErrorMessage(getFriendlyAuthError(result.error.message));
        return;
      }
      redirectTo = "/dashboard";
    }

    setStepMessage("Redirecting...");
    setStatus("success");
    router.push(redirectTo);
    router.refresh();
  }

  async function serverSideSignup(email: string, password: string) {
    try {
      const response = await fetch("/api/auth/student-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !data.success) {
        return { success: false, message: data.message ?? "Sign-up failed. Please try again." };
      }
      return { success: true, message: "" };
    } catch {
      return { success: false, message: "Network error. Please try again." };
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl normal-case tracking-tight">
          {isSignIn ? "Sign in to your account" : "Create your student account"}
        </CardTitle>
        <CardDescription>
          {isSignIn
            ? "Sign in with your Supabase account to continue."
            : "Use your SchoolApp email and password. We will verify your school account and create your student profile."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              minLength={6}
              disabled={isLoading}
              required
            />
          </div>

          {errorMessage ? (
            <StatusAlert message={errorMessage} tone="error" />
          ) : null}
          {stepMessage ? (
            <StatusAlert
              message={stepMessage}
              tone={status === "success" ? "success" : "loading"}
            />
          ) : null}

          <LoadingButton
            className="w-full rounded-xl"
            type="submit"
            isLoading={isLoading}
            loadingText={isSignIn ? "Signing in..." : "Creating account..."}
          >
            {isSignIn ? "Sign in" : "Create account"}
          </LoadingButton>
        </form>

        <Separator className="my-6" />

        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <p>
            {isSignIn ? "Need an account?" : "Already have an account?"}{" "}
            <Link
              href={isSignIn ? "/sign-up" : "/sign-in"}
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignIn ? "Student sign up" : "Sign in"}
              <IconArrowRight className="size-3.5" />
            </Link>
          </p>
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link href="/sign-up/teacher">Teacher sign up</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getFriendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Invalid email or password.";
  }
  if (m.includes("not confirmed") || m.includes("email confirmation")) {
    return "Email not confirmed. Please check your inbox.";
  }
  return `Sign-in failed: ${message}`;
}
