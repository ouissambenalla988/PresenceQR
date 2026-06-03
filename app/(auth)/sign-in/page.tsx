import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function SignInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Secure access"
      title="A smarter dashboard for students and teachers."
      description="Sign in to manage courses, follow sessions, and keep your school workflow in one polished workspace."
    >
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
