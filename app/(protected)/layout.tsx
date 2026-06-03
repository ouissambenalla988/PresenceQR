import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getAccessibleCourses,
  getConfirmedStaff,
  type StaffRow,
} from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  name: string | null;
};

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const role = String(user.user_metadata?.role ?? "student");
  const courses = await getAccessibleCourses(supabase, user);
  const displayName = await getDisplayName({
    role,
    supabase,
    userEmail: user.email ?? "",
    userId: user.id,
    userMetadataName:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null,
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfbf9,#f3f2ee)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full">
        <AppSidebar
          courses={courses}
          email={user.email ?? "No email"}
          name={displayName}
          role={role}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-7xl px-5 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

async function getDisplayName({
  role,
  supabase,
  userEmail,
  userId,
  userMetadataName,
}: {
  role: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userEmail: string;
  userId: string;
  userMetadataName: string | null;
}) {
  if (role === "teacher") {
    const staff = (await getConfirmedStaff(supabase, userId)) as StaffRow | null;
    return staff?.name ?? userMetadataName ?? userEmail;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("email", userEmail)
    .maybeSingle<ProfileRow>();

  return profile?.name ?? userMetadataName ?? userEmail;
}
