import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAccessibleCourses,
  getPeriodLabel,
  getSessionEventLabels,
  getStaffNameByUserId,
  type SessionRow,
} from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

type SessionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <UnavailableSession />;
  }

  const { data: sessionData } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<SessionRow>();

  if (!sessionData) {
    return <UnavailableSession />;
  }

  const accessibleCourses = await getAccessibleCourses(supabase, user);
  const course = accessibleCourses.find(
    (item) => item.code === sessionData.courses_id,
  );

  if (!course) {
    return <UnavailableSession />;
  }

  const teacherName = await getStaffNameByUserId(
    supabase,
    sessionData.teacher_id,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/courses/${encodeURIComponent(course.code)}`}
        backLabel="Back to course"
        eyebrow="Session"
        title="Session details"
        description={`${course.code}${course.name ? ` - ${course.name}` : ""}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>{course.code}</CardTitle>
          <CardDescription>
            {course.name ?? "Course name unavailable"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Date" value={sessionData.date ?? "Unavailable"} />
          <InfoBlock
            label="Period"
            value={getPeriodLabel(sessionData.isTP, Number(sessionData.period))}
          />
          <InfoBlock label="Type" value={sessionData.isTP ? "TP" : "Course"} />
          <InfoBlock label="Teacher" value={teacherName} />
          <InfoBlock label="Class / Section" value={sessionData.class} />
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Event
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {getSessionEventLabels(sessionData.event).map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UnavailableSession() {
  return (
    <EmptyState
      title="Session not found or unavailable."
      description="The session may not exist, or your account may not have access to it."
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
