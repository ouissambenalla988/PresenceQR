import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { extractStudyPlan } from "@/lib/scrapper";
import { scrapeAllCoursesForFiliere } from "@/lib/scrapper/courses";
import { createClient } from "@/lib/supabase/server";
import { visitUrl } from "@/lib/scrapper/utils";

const MODULES_URL = "https://schoolapp.ensam-umi.ac.ma/plan-etudes-view/modules";

/**
 * POST /api/study-plan/import
 *
 * Body: { niveau?: string; filiere?: string }
 *   - If omitted, uses the current student's profile values.
 *
 * Seeds the `courses` table with code + name + department
 * for every element in the study plan.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    niveau?: string;
    filiere?: string;
  };

  // Resolve filiere / niveau from body or student profile
  let niveau = body.niveau ?? "";
  let filiere = body.filiere ?? "";

  if (!niveau || !filiere) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("filiere, year")
      .eq("user_id", user.id)
      .maybeSingle();
    niveau ||= profile?.year ? `${profile.year}A` : ""; // year stored as int (e.g. 4 → "4A")
    filiere ||= profile?.filiere ?? "";
  }

  if (!niveau || !filiere) {
    return NextResponse.json(
      { success: false, message: "niveau and filiere are required." },
      { status: 400 },
    );
  }

  // Retrieve SchoolApp sessionId
  const sessionId = await getStoredSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { success: false, message: "SchoolApp session expired. Please reconnect." },
      { status: 400 },
    );
  }

  // Scrape all courses for this filiere + niveau
  const courses = await scrapeAllCoursesForFiliere({ niveau, filiere, sessionId });

  if (courses.length === 0) {
    return NextResponse.json(
      { success: false, message: "No courses found for this filiere/niveau." },
      { status: 404 },
    );
  }

  // Upsert into courses table
  const { error, count } = await supabase
    .from("courses")
    .upsert(
      courses.map((c) => ({ code: c.code, name: c.name, department: c.department })),
      { onConflict: "code", ignoreDuplicates: false, count: "exact" },
    );

  if (error) {
    console.error("Courses seed error:", error.message);
    return NextResponse.json(
      { success: false, message: `Database error: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    imported: count ?? courses.length,
    niveau,
    filiere,
    message: `${count ?? courses.length} courses seeded successfully.`,
  });
}

/**
 * GET /api/study-plan/import
 * Returns available niveaux + filieres from the study plan form dropdowns.
 */
export async function GET() {
  const sessionId = await getStoredSessionId();
  if (!sessionId) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const result = await visitUrl({
    toVisiteUrl: MODULES_URL,
    returnContent: true,
    sessionId,
  });

  if (!result || typeof result === "boolean") {
    return NextResponse.json(
      { success: false, message: "Could not load study plan." },
      { status: 502 },
    );
  }

  const plan = extractStudyPlan(result.data);

  return NextResponse.json({
    success: true,
    levels: plan.levels,
    programs: plan.programs,
    semesters: plan.semesters,
  });
}

async function getStoredSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const direct = cookieStore.get("sessionId")?.value;
  if (direct) return direct;

  const userCookie = cookieStore.get("user")?.value;
  if (!userCookie) return null;

  try {
    const parsed = JSON.parse(userCookie) as { sessionId?: string };
    return parsed.sessionId ?? null;
  } catch {
    return null;
  }
}
