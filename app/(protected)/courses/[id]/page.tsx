import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SessionCard } from "@/components/session-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCourseLabel } from "@/lib/course-display";
import {
  getAccessibleCourses,
  getStaffNameByUserId,
  type SessionRow,
} from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

type CoursePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const courseCode = decodeURIComponent(id);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <UnavailableCourse />;
  }

  const courses = await getAccessibleCourses(supabase, user);
  const course = courses.find((item) => item.code === courseCode);

  if (!course) {
    return <UnavailableCourse />;
  }

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("courses_id", course.code)
    .order("date", { ascending: false });

  const sessionRows = (sessions ?? []) as SessionRow[];
  const teacherNames = new Map<string, string>();

  for (const teacherId of [
    ...new Set(sessionRows.map((session) => session.teacher_id)),
  ]) {
    teacherNames.set(teacherId, await getStaffNameByUserId(supabase, teacherId));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/courses"
        backLabel="Back to courses"
        eyebrow="Course"
        title={course.code}
        description={course.name ?? "Course name unavailable"}
      />

      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
          <CardDescription>{getCourseLabel(course)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Course code" value={course.code} />
          <InfoBlock label="Course name" value={course.name ?? "Unavailable"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions and events</CardTitle>
          <CardDescription>
            Roll call and presentation sessions for this course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionRows.length > 0 ? (
            sessionRows.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                teacherName={
                  teacherNames.get(session.teacher_id) ?? "Unavailable"
                }
              />
            ))
          ) : (
            <EmptyState
              title="No sessions found"
              description="Roll call and presentation events for this course will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UnavailableCourse() {
  return (
    <EmptyState
      title="Course not found or unavailable."
      description="The course may not exist, or your account may not have access to it."
    />
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}
