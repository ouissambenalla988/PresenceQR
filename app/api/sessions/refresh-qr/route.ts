import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConfirmedStaff } from "@/lib/school-data";

/**
 * POST /api/sessions/refresh-qr
 * Body: { sessionId: string }
 *
 * Generates a new qr_token + qr_expires_at (+30s) for the given session.
 * Only the session owner (teacher) can refresh.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const { sessionId } = await request.json() as { sessionId?: string };
  if (!sessionId) {
    return NextResponse.json({ success: false, message: "sessionId is required." }, { status: 400 });
  }

  // Verify the session belongs to this teacher
  const { data: session } = await supabase
    .from("sessions")
    .select("id, teacher_id, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ success: false, message: "Session not found." }, { status: 404 });
  }

  if (session.teacher_id !== user.id) {
    const staff = await getConfirmedStaff(supabase, user.id);
    if (!staff) {
      return NextResponse.json({ success: false, message: "Not authorized." }, { status: 403 });
    }
  }

  if (session.status !== "active") {
    return NextResponse.json({ success: false, message: "Session is not active." }, { status: 400 });
  }

  // Generate new QR token (crypto.randomUUID() is available in Next.js edge/node)
  const newToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30_000).toISOString();

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({ qr_token: newToken, qr_expires_at: expiresAt })
    .eq("id", sessionId)
    .select("qr_token, qr_expires_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: `Failed to refresh QR: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    qrToken: updated.qr_token,
    qrExpiresAt: updated.qr_expires_at,
  });
}
