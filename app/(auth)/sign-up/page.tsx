import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Student onboarding"
      title="Connect your school account and start organized."
      description="Create your student workspace, verify your SchoolApp profile, and bring your courses into SchoolApp+."
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
