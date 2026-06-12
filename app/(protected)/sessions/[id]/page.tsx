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
  SessionLiveView,
  type RosterRow,
  type SessionMeta,
} from "@/components/session-live-view";
import {
  getAccessibleCourses,
  getConfirmedStaff,
  getPeriodLabel,
  getSessionEventLabels,
  getStaffNameByUserId,
  type SessionRow,
} from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type SessionPageProps = {
  params: Promise<{ id: string }>;
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

  const courseCode = course?.code ?? sessionData.courses_id;
  const courseName = course?.name ?? null;
  const teacherName = await getStaffNameByUserId(supabase, sessionData.teacher_id);
  const periodLabel = getPeriodLabel(sessionData.isTP, Number(sessionData.period));

  // Teacher (session owner or confirmed staff) → live attendance view
  const isOwner = sessionData.teacher_id === user.id;
  const staff = isOwner ? null : await getConfirmedStaff(supabase, user.id);
  const isTeacher = isOwner || Boolean(staff);

  if (isTeacher) {
    // Initial roster via service client (RPC bypasses student-profile RLS)
    const service = createServiceClient();
    const { data: rosterData } = await service.rpc("get_session_roster", {
      p_session_id: id,
    });

    const deepLinkBase =
      process.env.QR_DEEPLINK_BASE ??
      process.env.DEMO_QR_DEEPLINK_BASE ??
      "presenceqr://scan?code=";

    // Fixed QR hash from env — does not rotate per session
    const qrToken = process.env.QR_HASH ?? null;

    const meta: SessionMeta = {
      id: sessionData.id,
      courseCode,
      courseName,
      section: sessionData.class,
      date: sessionData.date ?? "—",
      periodLabel,
      teacherName,
      room: sessionData.room ?? null,
      isTP: sessionData.isTP,
      eventLabels: getSessionEventLabels(sessionData.event),
      qrToken,
      deepLinkBase,
    };

    return (
      <div className="space-y-6">
        <PageHeader
          backHref="/dashboard"
          backLabel="Retour au tableau de bord"
          eyebrow="Séance en direct"
          title={courseName ?? courseCode}
          description={`${courseCode} • ${sessionData.class} • ${sessionData.date}`}
        />
        <SessionLiveView meta={meta} initialRoster={(rosterData ?? []) as RosterRow[]} />
      </div>
    );
  }

  // Student → read-only details
  if (!course) {
    return <UnavailableSession />;
  }

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
          <InfoBlock label="Period" value={periodLabel} />
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
