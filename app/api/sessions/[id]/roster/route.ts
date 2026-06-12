import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getConfirmedStaff } from "@/lib/school-data";

export type RosterRow = {
  student_id: string;
  code: string | null;
  nom: string | null;
  prenom: string | null;
  section: string | null;
  status: "present" | "absent" | "late" | "excused";
  qr_scanned: boolean;
  marked_at: string | null;
};

/**
 * GET /api/sessions/[id]/roster
 * Returns the enrolled students of the session's course+section with their
 * present/absent status. Only the owning teacher (or confirmed staff) may read it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  // Verify access: session owner teacher, or confirmed staff
  const { data: session } = await supabase
    .from("sessions")
    .select("id, teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ success: false, message: "Session not found." }, { status: 404 });
  }

  if (session.teacher_id !== user.id) {
    const staff = await getConfirmedStaff(supabase, user.id);
    if (!staff) {
      return NextResponse.json({ success: false, message: "Not authorized." }, { status: 403 });
    }
  }

  // Use the service client to run the roster function (bypasses student-profile RLS)
  const service = createServiceClient();
  const { data, error } = await service.rpc("get_session_roster", { p_session_id: id });

  if (error) {
    console.error("get_session_roster error:", error.message);
    return NextResponse.json(
      { success: false, message: `Could not load roster: ${error.message}` },
      { status: 500 },
    );
  }

  const roster = (data ?? []) as RosterRow[];
  const present = roster.filter((r) => r.status !== "absent").length;

  return NextResponse.json({
    success: true,
    roster,
    total: roster.length,
    present,
    absent: roster.length - present,
  });
}

/**
 * POST /api/sessions/[id]/roster
 * Body: { studentId: string, status: "present" | "absent" | "late" | "excused" }
 * Lets the owning teacher manually set a student's attendance status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const { studentId, status } = (await request.json()) as {
    studentId?: string;
    status?: RosterRow["status"];
  };

  if (!studentId || !status) {
    return NextResponse.json(
      { success: false, message: "studentId and status are required." },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ success: false, message: "Session not found." }, { status: 404 });
  }
  if (session.teacher_id !== user.id) {
    const staff = await getConfirmedStaff(supabase, user.id);
    if (!staff) {
      return NextResponse.json({ success: false, message: "Not authorized." }, { status: 403 });
    }
  }

  const service = createServiceClient();
  const { error } = await service
    .from("attendance")
    .upsert(
      { session_id: id, student_id: studentId, status, qr_scanned: false },
      { onConflict: "session_id,student_id" },
    );

  if (error) {
    return NextResponse.json(
      { success: false, message: `Could not update attendance: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
