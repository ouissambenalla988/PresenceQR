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

    const result = isSignIn
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              role: "student",
            },
          },
        });

    if (result.error) {
      setStatus("error");
      setStepMessage(null);
      setErrorMessage(getFriendlyAuthError(result.error.message, isSignIn));
      return;
    }

    let redirectTo = searchParams.get("redirectedFrom") ?? "/dashboard";

    if (isSignIn) {
      setStepMessage("Redirecting...");
    } else {
      setStepMessage("Connecting to SchoolApp...");
      const connection = await connectSchoolApp(email, password);
      if (!connection.success) {
        setStatus("error");
        setStepMessage(null);
        setErrorMessage(connection.message);
        return;
      } else {
        redirectTo = "/dashboard?uncompleted=true";
      }
    }

    setStepMessage("Redirecting...");
    setStatus("success");
    router.push(redirectTo);
    router.refresh();
  }

  async function connectSchoolApp(email: string, password: string) {
    try {
      setStepMessage("Checking your school account...");
      const response = await fetch("/api/schoolapp-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: getFriendlyPlatformError(data.message),
        };
      }

      setStepMessage("Fetching your student profile...");
      setStepMessage("Saving your profile...");
      return { success: true, message: "SchoolApp connected." };
    } catch {
      return {
        success: false,
        message: "Network/server error. Please try again.",
      };
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

function getFriendlyAuthError(message: string, isSignIn: boolean) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid")) {
    return isSignIn
      ? "Invalid Supabase credentials. Check your email and password."
      : "This account could not be created with those credentials.";
  }

  if (lowerMessage.includes("already")) {
    return "An account already exists for this email. Try signing in instead.";
  }

  return "Supabase authentication failed. Please check your details and try again.";
}

function getFriendlyPlatformError(message?: string) {
  if (!message) {
    return "School platform login failed. Please check your SchoolApp credentials.";
  }

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid") || lowerMessage.includes("authentication")) {
    return "School platform login failed. Please check your SchoolApp email and password.";
  }

  if (lowerMessage.includes("profile")) {
    return "Profile could not be created from your SchoolApp account.";
  }

  return message;
}
