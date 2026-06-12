import { NextRequest, NextResponse } from "next/server";

import { getConfirmedStaff } from "@/lib/school-data";
import { createClient } from "@/lib/supabase/server";

type ActionType = "roll_call" | "presentation";
type SessionType = "course" | "TP";

/** period label → (1-based index, start-time string) */
const PERIOD_MAP: Record<SessionType, Array<{ label: string; time: string }>> = {
  TP: [
    { label: "08:30 - 11:30", time: "08:30" },
    { label: "11:30 - 14:30", time: "11:30" },
    { label: "13:30 - 16:30", time: "13:30" },
    { label: "16:30 - 19:30", time: "16:30" },
  ],
  course: [
    { label: "08:30 - 10:30", time: "08:30" },
    { label: "10:30 - 12:30", time: "10:30" },
    { label: "14:30 - 16:30", time: "14:30" },
    { label: "16:30 - 18:30", time: "16:30" },
  ],
};

const CUSTOM_PERIOD_SENTINEL = 5;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "You must be signed in." },
      { status: 401 },
    );
  }

  if (user.user_metadata?.role !== "teacher") {
    return NextResponse.json(
      { success: false, message: "Only teachers can create sessions." },
      { status: 403 },
    );
  }

  const staff = await getConfirmedStaff(supabase, user.id);
  if (!staff) {
    return NextResponse.json(
      { success: false, message: "Teacher status is pending confirmation." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    actionType?: ActionType;
    courseId?: string;
    date?: string;
    period?: string;           // label or "custom"
    customStartTime?: string;  // "HH:mm" — only when period === "custom"
    section?: string;
    sessionType?: SessionType;
    room?: string;
    lateToleranceMinutes?: number;
  };

  if (
    !body.actionType ||
    !body.courseId ||
    !body.date ||
    !body.period ||
    !body.section ||
    !body.sessionType
  ) {
    return NextResponse.json(
      { success: false, message: "Missing required session fields." },
      { status: 400 },
    );
  }

  let periodIndex: number;
  let sessionTime: string;

  if (body.period === "custom") {
    if (!body.customStartTime || !/^\d{2}:\d{2}$/.test(body.customStartTime)) {
      return NextResponse.json(
        { success: false, message: "customStartTime (HH:mm) is required for custom period." },
        { status: 400 },
      );
    }
    periodIndex = CUSTOM_PERIOD_SENTINEL;
    sessionTime = body.customStartTime;
  } else {
    const periods = PERIOD_MAP[body.sessionType];
    const found = periods?.findIndex((p) => p.label === body.period);
    if (found === undefined || found < 0) {
      return NextResponse.json(
        { success: false, message: "Invalid period for the selected session type." },
        { status: 400 },
      );
    }
    periodIndex = found + 1;
    sessionTime = periods[found].time;
  }

  const lateToleranceMinutes =
    typeof body.lateToleranceMinutes === "number" &&
    body.lateToleranceMinutes >= 0 &&
    body.lateToleranceMinutes <= 120
      ? body.lateToleranceMinutes
      : 10;

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      date: body.date,
      courses_id: body.courseId,
      isTP: body.sessionType === "TP",
      period: periodIndex,
      class: body.section,
      room: body.room?.trim() || null,
      event: body.actionType === "roll_call" ? "roll" : "presentation",
      status: "active",
      session_time: sessionTime,
      late_tolerance_minutes: lateToleranceMinutes,
    })
    .select("id, qr_token, qr_expires_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: `Could not create session: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Session created successfully.",
    sessionId: session.id,
    qrToken: session.qr_token,
    qrExpiresAt: session.qr_expires_at,
  });
}
