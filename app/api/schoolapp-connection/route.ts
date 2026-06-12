import { NextRequest, NextResponse } from "next/server";

import { loginToSchoolApp, SchoolAppAuthError } from "@/lib/scrapper/login";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildProfilePayload } from "@/lib/profile-payload";
import {
  encryptCreds,
  SID_COOKIE,
  CREDS_COOKIE,
  sidCookieOptions,
  credsCookieOptions,
} from "@/lib/schoolapp-session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 },
      );
    }

    let sessionId: string;
    let studentInfo: Awaited<ReturnType<typeof loginToSchoolApp>>["studentInfo"];
    try {
      const result = await loginToSchoolApp(email, password);
      sessionId = result.sessionId;
      studentInfo = result.studentInfo;
    } catch (err) {
      if (err instanceof SchoolAppAuthError) {
        return NextResponse.json(
          { success: false, message: err.code === "INVALID_CREDENTIALS"
              ? "Invalid SchoolApp credentials."
              : "SchoolApp unavailable. Try again later." },
          { status: err.code === "INVALID_CREDENTIALS" ? 401 : 503 },
        );
      }
      throw err;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "No active session. Please sign in first." },
        { status: 401 },
      );
    }

    const serviceClient = createServiceClient();
    const { error: profileError } = await serviceClient.from("profiles").upsert(
      { ...buildProfilePayload(studentInfo, user.id), email },
      { onConflict: "email" },
    );

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return NextResponse.json(
        { success: false, message: `Profile error: ${profileError.message}` },
        { status: 500 },
      );
    }

    const response = NextResponse.json({
      success: true,
      studentInfo,
      message: "Authentication successful",
    });

    // Short-lived session cookie
    response.cookies.set(SID_COOKIE, sessionId, sidCookieOptions);
    // Long-lived encrypted credentials for auto-reconnect (30 days)
    response.cookies.set(CREDS_COOKIE, encryptCreds(`${email}:${password}`), credsCookieOptions);
    // Legacy name kept for other code that reads "sessionId"
    response.cookies.set("sessionId", sessionId, sidCookieOptions);

    return response;
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
