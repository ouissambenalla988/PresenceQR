"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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

type AuthStatus = "idle" | "loading" | "success" | "error";

export function TeacherSignUpForm() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLoading = status === "loading";

  async function handleSubmit(formData: FormData) {
    if (isLoading) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    setStepMessage("Creating your teacher account...");

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          role: "teacher",
          name,
        },
      },
    });

    if (signUpError) {
      setStatus("error");
      setStepMessage(null);
      setErrorMessage(signUpError.message);
      return;
    }

    setStatus("success");
    setStepMessage("Redirecting...");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl normal-case tracking-tight">
          Teacher sign up
        </CardTitle>
        <CardDescription>
          Create a teacher account. An admin must confirm your teacher status
          before dashboard tools are enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teacher-name">Name</Label>
            <Input
              id="teacher-name"
              name="name"
              autoComplete="name"
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-email">Email</Label>
            <Input
              id="teacher-email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher-password">Password</Label>
            <Input
              id="teacher-password"
              name="password"
              type="password"
              autoComplete="new-password"
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
            loadingText="Creating teacher account..."
          >
            Create teacher account
          </LoadingButton>
        </form>
        <Separator className="my-6" />
        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <p>
            Signing up as a student?{" "}
            <Button asChild variant="link" className="h-auto p-0 normal-case tracking-normal">
              <Link href="/sign-up" className="inline-flex items-center gap-1">
                Use student signup
                <IconArrowRight className="size-3.5" />
              </Link>
            </Button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
