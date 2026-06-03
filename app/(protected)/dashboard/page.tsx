import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { IconArrowRight, IconSparkles } from "@tabler/icons-react";
import { DashboardClient } from "@/components/dashboard-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SessionCard } from "@/components/session-card";
import { TeacherSessionActions } from "@/components/teacher-session-actions";
import {
  getCourseCode,
  getCourseLabel,
  getCourseName,
} from "@/lib/course-display";
import {
  getConfirmedStaff,
  mapStudentCoursesToDisplay,
  getStaffNameByUserId,
  type StaffRow,
  type SessionRow,
  type StudentCourseRow,
} from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams?: Promise<{
    uncompleted?: string;
    platformError?: string;
  }>;
};

type Profile = {
  email: string | null;
  name: string | null;
  code: string | null;
  section: string | null;
  group_name: string | null;
  subgroup: string | null;
  status: string | null;
  year: number | string | null;
};

type CourseRow = {
  id?: string | number | null;
  code?: string | null;
  course_code?: string | null;
  name?: string | null;
  title?: string | null;
  [key: string]: unknown;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const role = user?.user_metadata?.role;

  const { data: studentCourses } = await supabase.from("student_courses").select("*");
  const { data: courses } = await supabase.from("courses").select("*");
  const courseDisplays = mapStudentCoursesToDisplay(
    (studentCourses ?? []) as StudentCourseRow[],
    (courses ?? []) as CourseRow[],
  );

  if (role === "teacher") {
    const staff = user?.id
      ? await getConfirmedStaff(supabase, user.id)
      : null;

    if (!staff) {
      return <PendingTeacherDashboard />;
    }

    const recentSessions = await getRecentTeacherSessions(supabase);
    const teacherNames = await getTeacherNames(supabase, recentSessions);

    return (
      <TeacherDashboard
        staff={staff}
        courses={(courses ?? []) as CourseRow[]}
        recentSessions={recentSessions}
        teacherNames={teacherNames}
      />
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user?.email ?? "")
    .maybeSingle<Profile>();
  const recentSessions = await getRecentSessions(
    supabase,
    courseDisplays.map((course) => course.code),
  );
  const teacherNames = await getTeacherNames(supabase, recentSessions);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back${profile?.name ? `, ${profile.name}` : ""}`}
        description="Your courses, sessions, and SchoolApp profile in one focused workspace."
      />

      {profile ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                {getInitials(profile.name)}
              </div>
              <div>
                <p className="font-semibold">{profile.name ?? "Student"}</p>
                <p className="text-sm text-muted-foreground">
                  {profile.code ?? "No student code"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.section ?? "No section"}</Badge>
              <Badge variant="secondary">{profile.group_name ?? "No group"}</Badge>
              {profile.subgroup ? (
                <Badge variant="secondary">{profile.subgroup}</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DashboardClient
        hasProfile={Boolean(profile)}
        initialCourses={courseDisplays}
        platformError={params?.platformError}
        shouldImportCourses={Boolean(profile) && courseDisplays.length === 0}
      />

      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Recent sessions</CardTitle>
              <CardDescription>
                Latest roll call and presentation events tied to your courses.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                teacherName={teacherNames.get(session.teacher_id) ?? "Unavailable"}
              />
            ))
          ) : (
            <EmptyState
              title="No recent sessions"
              description="Sessions will appear here when teachers create roll call or presentation events for your courses."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function getRecentSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseCodes: string[],
) {
  if (courseCodes.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .in("courses_id", courseCodes)
    .order("date", { ascending: false })
    .limit(3);

  return (data ?? []) as SessionRow[];
}

async function getTeacherNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessions: SessionRow[],
) {
  const teacherNames = new Map<string, string>();

  for (const teacherId of [...new Set(sessions.map((session) => session.teacher_id))]) {
    teacherNames.set(teacherId, await getStaffNameByUserId(supabase, teacherId));
  }

  return teacherNames;
}

async function getRecentTeacherSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(3);

  return (data ?? []) as SessionRow[];
}

function PendingTeacherDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Teacher approval pending"
        description="Your account is created and waiting for staff confirmation."
      />

      <Card>
        <CardHeader>
          <CardTitle>Waiting for admin confirmation</CardTitle>
          <CardDescription>
            Your teacher account was created, but an admin still needs to
            confirm your teacher status before you can use teacher features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once your account is confirmed in the staff table, this dashboard
            will show roll call and presentation tools.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherDashboard({
  courses,
  recentSessions,
  staff,
  teacherNames,
}: {
  courses: CourseRow[];
  recentSessions: SessionRow[];
  staff: StaffRow;
  teacherNames: Map<string, string>;
}) {
  const courseOptions = courses
    .map((course) => {
      const code = getCourseCode(course);
      return {
        code,
        name: getCourseName(course),
      };
    })
    .filter((course) => course.code);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome, ${staff.name ?? "Teacher"}`}
        description="Launch sessions, review courses, and monitor classroom activity."
        actions={<Badge variant="secondary">Teacher</Badge>}
      />

      <Card
        size="sm"
        className="bg-[linear-gradient(135deg,oklch(0.99_0.01_105),oklch(0.96_0.04_88))]"
      >
        <CardHeader>
          <CardTitle>Teacher actions</CardTitle>
          <CardDescription>
            Start classroom sessions for roll call or presentations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TeacherSessionActions courses={courseOptions} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconSparkles className="size-4" />
              Actions create live session records.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Courses</CardTitle>
              <CardDescription>
                A quick preview of available courses.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{courseOptions.length} courses</Badge>
              <Link href="/courses" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
                View all courses
                <IconArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {courseOptions.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {courseOptions.slice(0, 5).map((course) => (
                <CourseCard key={course.code} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState title="No courses found" description="Courses from the courses table will appear here when available." />
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>
            Session activity will appear here after roll call or presentation sessions are created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  teacherName={teacherNames.get(session.teacher_id) ?? "Unavailable"}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent sessions yet"
              description="Start a roll call or presentation session to populate this activity feed."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) {
    return "SP";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
