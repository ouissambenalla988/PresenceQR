import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loginToSchoolApp, SchoolAppAuthError } from "@/lib/scrapper/login";
import { buildProfilePayload } from "@/lib/profile-payload";
import {
  encryptCreds,
  SID_COOKIE,
  CREDS_COOKIE,
  sidCookieOptions,
  credsCookieOptions,
} from "@/lib/schoolapp-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Accepte les deux formats Supabase : JWT (eyJ...) et nouveau format (sb_secret_...)
const hasServiceRole =
  !!SERVICE_KEY &&
  SERVICE_KEY !== "REMPLACE_PAR_TA_SERVICE_ROLE_KEY" &&
  (SERVICE_KEY.startsWith("eyJ") || SERVICE_KEY.startsWith("sb_secret_"));

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authedClient(accessToken: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 },
      );
    }

    // 1. Verify SchoolApp credentials + scrape student info
    let sessionId: string;
    let studentInfo: Awaited<ReturnType<typeof loginToSchoolApp>>["studentInfo"];
    try {
      const result = await loginToSchoolApp(email, password);
      sessionId = result.sessionId;
      studentInfo = result.studentInfo;
    } catch (err) {
      if (err instanceof SchoolAppAuthError) {
        if (err.code === "INVALID_CREDENTIALS") {
          return NextResponse.json(
            { success: false, message: "Invalid SchoolApp credentials. Check your email and password." },
            { status: 401 },
          );
        }
        return NextResponse.json(
          { success: false, message: "SchoolApp is currently unavailable. Try again later." },
          { status: 503 },
        );
      }
      throw err;
    }

    // Use the sign-up email as the canonical key (SchoolApp's Email field may be blank/different)
    const profilePayload = { ...buildProfilePayload(studentInfo), email };

    // 2a. Admin path — service role key present
    if (hasServiceRole) {
      const admin = serviceClient();
      let userId: string;

      const { data: existing } = await admin.auth.admin.listUsers();
      const existingUser = existing?.users?.find((u) => u.email === email);

      if (existingUser) {
        userId = existingUser.id;
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createError || !created.user) {
          return NextResponse.json(
            { success: false, message: `Could not create account: ${createError?.message}` },
            { status: 500 },
          );
        }
        userId = created.user.id;
      }

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({ ...profilePayload, user_id: userId }, { onConflict: "email" });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
        return NextResponse.json(
          { success: false, message: `Profile could not be saved: ${profileError.message}` },
          { status: 500 },
        );
      }
    } else {
      // 2b. Fallback path — anon key only (requires email confirmations DISABLED in Supabase Auth)
      const auth = anonClient();
      let accessToken: string;
      let userId: string;

      const { data: signUpData, error: signUpError } = await auth.auth.signUp({ email, password });

      if (signUpError) {
        const isAlreadyRegistered =
          signUpError.message.toLowerCase().includes("already registered") ||
          signUpError.message.toLowerCase().includes("user already exists");

        if (!isAlreadyRegistered) {
          return NextResponse.json(
            { success: false, message: `Could not create account: ${signUpError.message}` },
            { status: 500 },
          );
        }

        // User exists — sign in to get session
        const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError || !signInData.user) {
          return NextResponse.json(
            { success: false, message: "Account already exists but password is incorrect." },
            { status: 401 },
          );
        }
        userId = signInData.user.id;
        accessToken = signInData.session.access_token;
      } else {
        if (!signUpData.user || !signUpData.session) {
          // Email confirmation required — inform user
          return NextResponse.json(
            {
              success: false,
              message:
                "Email confirmation required. Disable 'Email confirmations' in Supabase Auth settings, or add SUPABASE_SERVICE_ROLE_KEY to .env.",
            },
            { status: 500 },
          );
        }
        userId = signUpData.user.id;
        accessToken = signUpData.session.access_token;
      }

      // Upsert profile with authenticated client
      const client = authedClient(accessToken);
      const { error: profileError } = await client
        .from("profiles")
        .upsert({ ...profilePayload, user_id: userId }, { onConflict: "email" });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
        return NextResponse.json(
          { success: false, message: `Profile could not be saved: ${profileError.message}` },
          { status: 500 },
        );
      }
    }

    const response = NextResponse.json({ success: true, message: "Account ready" });
    // Session cookie (short-lived) + encrypted credentials (30 days) for auto-reconnect
    response.cookies.set(SID_COOKIE, sessionId, sidCookieOptions);
    response.cookies.set(CREDS_COOKIE, encryptCreds(`${email}:${password}`), credsCookieOptions);
    response.cookies.set("sessionId", sessionId, sidCookieOptions); // legacy name
    return response;
  } catch (error) {
    console.error("Student signup error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
