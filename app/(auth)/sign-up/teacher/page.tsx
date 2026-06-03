import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { TeacherSignUpForm } from "@/components/teacher-sign-up-form";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherSignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Teacher access"
      title="Create a teacher workspace without student scraping."
      description="Teacher accounts are created directly in Supabase and become active once an admin confirms staff access."
    >
      <TeacherSignUpForm />
    </AuthShell>
  );
}
