import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { scrapeStudentCourseCodes, enrichCoursesWithNames } from "@/lib/scrapper/courses";
import { getCourseName, type StudentCourseDisplay } from "@/lib/course-display";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loginToSchoolApp } from "@/lib/scrapper/login";
import { yearToNiveau } from "@/lib/profile-payload";
import {
  decryptCreds,
  SID_COOKIE,
  CREDS_COOKIE,
  sidCookieOptions,
} from "@/lib/schoolapp-session";

// The server's own links are root-relative ("/student/inscriptioncours"),
// but some deployments are mounted under "/schoolapp". Try both.
const COURSE_REGISTRATION_PATH = "/student/inscriptioncours";
const SCHOOLAPP_BASES = [
  "https://schoolapp.ensam-umi.ac.ma",
  "https://schoolapp.ensam-umi.ac.ma/schoolapp",
];

export async function POST() {
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

  // ── 1. Check for already-saved courses ───────────────────────────
  const { data: savedCourses, error: savedCoursesError } = await supabase
    .from("student_courses")
    .select("course_id");

  if (savedCoursesError) {
    // Log real error for debugging; treat as "no saved courses" and continue scraping
    console.warn("student_courses SELECT failed (continuing):", savedCoursesError.message, savedCoursesError.code);
  }

  if (savedCourses && savedCourses.length > 0) {
    // Courses already imported — return them (try to refresh names if null)
    const courseCodes = savedCourses.map((c) => String(c.course_id));
    const courses = await getCoursesByCode(supabase, courseCodes);

    const missingNames = courses.filter((c) => !c.name).map((c) => c.code);
    if (missingNames.length > 0) {
      const ck = await cookies();
      const sid = ck.get(SID_COOKIE)?.value ?? ck.get("sessionId")?.value;
      if (sid) await refreshCourseNames(supabase, missingNames, sid, user.id);
    }

    return NextResponse.json({
      success: true,
      courseCodes,
      courses: await getCoursesByCode(supabase, courseCodes),
      message: "Loaded saved courses.",
    });
  }

  // ── 2. Resolve SchoolApp session (auto-reconnect from cookie if expired) ──
  const cookieStore = await cookies();
  const rawSid   = cookieStore.get(SID_COOKIE)?.value ?? cookieStore.get("sessionId")?.value;
  const rawCreds = cookieStore.get(CREDS_COOKIE)?.value;

  // Fetch the "Mes cours" page, trying each base URL until one returns an
  // authenticated page (contains the course table, not the login form).
  const fetchPage = async (sid: string): Promise<string | null> => {
    for (const base of SCHOOLAPP_BASES) {
      try {
        const res = await fetch(`${base}${COURSE_REGISTRATION_PATH}`, {
          redirect: "follow",
          headers: {
            Cookie: `JSESSIONID=${sid}`,
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,*/*",
          },
        });
        const html = await res.text();
        const onLogin =
          res.url.includes("/login") ||
          html.includes('name="password"') ||
          html.includes('action="/login"');
        // Authenticated "Mes cours" page reliably contains the CodeElem table
        // header and a /logout link in the navbar modal.
        const authenticated =
          !onLogin &&
          (html.includes("CodeElem") ||
            html.includes("inscriptioncours") ||
            html.includes('href="/logout"'));
        if (authenticated) return html;
      } catch {
        /* try the next base */
      }
    }
    return null;
  };

  const tryReconnect = async (): Promise<{ sid: string; html: string } | null> => {
    if (!rawCreds) return null;
    try {
      const plain = decryptCreds(rawCreds);
      const sep   = plain.indexOf(":");
      if (sep === -1) return null;
      const freshResult = await loginToSchoolApp(plain.slice(0, sep), plain.slice(sep + 1));
      const freshHtml   = await fetchPage(freshResult.sessionId);
      if (!freshHtml) return null;
      return { sid: freshResult.sessionId, html: freshHtml };
    } catch {
      return null;
    }
  };

  let usedSessionId = rawSid ?? "";
  let html: string | null = rawSid ? await fetchPage(rawSid) : null;

  // Session expired — try auto-reconnect using saved credentials cookie
  if (!html) {
    const reconnected = await tryReconnect();
    if (reconnected) {
      usedSessionId = reconnected.sid;
      html = reconnected.html;
      // Refresh the short-lived session cookie transparently
      cookieStore.set(SID_COOKIE, reconnected.sid, sidCookieOptions);
      cookieStore.set("sessionId", reconnected.sid, sidCookieOptions);
    }
  }

  if (!html) {
    return NextResponse.json(
      { success: false, message: "SchoolApp session expired. Please reconnect your profile." },
      { status: 502 },
    );
  }

  const courseCodes = scrapeStudentCourseCodes(html);

  if (courseCodes.length === 0) {
    return NextResponse.json({
      success: true,
      courseCodes: [],
      courses: [],
      message: "No courses found in SchoolApp.",
    });
  }

  // ── 3. Fetch student profile to get filiere + niveau + section ───
  const { data: profile } = await supabase
    .from("profiles")
    .select("filiere, year, section")
    .eq("user_id", user.id)
    .maybeSingle();

  const filiere = profile?.filiere ?? "";
  const niveau = yearToNiveau(profile?.year);
  const section = profile?.section ?? null;

  // ── 4. Enrich codes with names from study plan ───────────────────
  const enriched = await enrichCoursesWithNames({
    courseCodes,
    niveau,
    filiere,
    sessionId: usedSessionId,
  });

  // ── 5. Upsert into courses table (code + name + department) ──────
  const serviceClient = createServiceClient();
  if (enriched.length > 0) {
    const { error: courseUpsertError } = await serviceClient
      .from("courses")
      .upsert(
        enriched.map((c) => ({
          code: c.code,
          name: c.name ?? c.code, // fallback: use code as name if enrichment failed
          department: c.department ?? null,
        })),
        { onConflict: "code", ignoreDuplicates: false },
      );

    if (courseUpsertError) {
      console.error("Course upsert error:", courseUpsertError.message);
    }
  }

  // ── 6. Insert into student_courses (with section for roster matching) ──
  const rowsToInsert = courseCodes.map((course_id) => ({
    course_id,
    user_id: user.id,
    section,
  }));

  const { error: insertError } = await serviceClient
    .from("student_courses")
    .upsert(rowsToInsert, { onConflict: "user_id,course_id", ignoreDuplicates: true });

  if (insertError) {
    console.error("student_courses upsert error:", insertError.message, insertError.code);
    return NextResponse.json(
      { success: false, message: `Could not save courses: ${insertError.message}` },
      { status: 500 },
    );
  }

  const courses = await getCoursesByCode(supabase, courseCodes);

  return NextResponse.json({
    success: true,
    courseCodes,
    courses,
    message: "Courses imported successfully.",
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

async function getCoursesByCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseCodes: string[],
): Promise<StudentCourseDisplay[]> {
  const { data } = await supabase
    .from("courses")
    .select("code, name")
    .in("code", courseCodes);

  const byCode = new Map((data ?? []).map((c) => [String(c.code ?? ""), c.name]));

  return courseCodes.map((code) => ({
    code,
    name: byCode.get(code) ?? null,
  }));
}

async function refreshCourseNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  missingCodes: string[],
  sessionId: string,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("filiere, year")
    .eq("user_id", userId)
    .maybeSingle();

  const enriched = await enrichCoursesWithNames({
    courseCodes: missingCodes,
    niveau: yearToNiveau(profile?.year),
    filiere: profile?.filiere ?? "",
    sessionId,
  });

  const toUpdate = enriched.filter((c) => c.name);
  if (toUpdate.length === 0) return;

  await supabase
    .from("courses")
    .upsert(
      toUpdate.map((c) => ({ code: c.code, name: c.name, department: c.department })),
      { onConflict: "code", ignoreDuplicates: false },
    );
}

