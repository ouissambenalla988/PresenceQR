import * as cheerio from "cheerio";
import { extractStudentInfo, StudentInfo } from "@/lib/scrapper";

const BASE_URL = "https://schoolapp.ensam-umi.ac.ma";
const LOGIN_URL = `${BASE_URL}/login`;
const DASHBOARD_URL = `${BASE_URL}/index`;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function extractSessionId(headers: Headers): string | null {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  return match ? match[1] : null;
}

export class SchoolAppAuthError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "UNAVAILABLE" | "CSRF_MISSING") {
    super(code);
  }
}

export interface SchoolAppSession {
  sessionId: string;
  studentInfo: StudentInfo;
}

export async function loginToSchoolApp(
  email: string,
  password: string,
): Promise<SchoolAppSession> {
  // 1. Fetch login page to get CSRF token + initial session
  let loginPageRes: Response;
  try {
    loginPageRes = await fetch(LOGIN_URL, {
      redirect: "manual",
      headers: { "User-Agent": UA, "Cache-Control": "no-cache" },
    });
  } catch {
    throw new SchoolAppAuthError("UNAVAILABLE");
  }

  if (!loginPageRes.ok && loginPageRes.status !== 302) {
    throw new SchoolAppAuthError("UNAVAILABLE");
  }

  const $login = cheerio.load(await loginPageRes.text());
  const csrfToken = $login('input[name="_csrf"]').val() as string;
  if (!csrfToken) throw new SchoolAppAuthError("CSRF_MISSING");

  const initialSessionId = extractSessionId(loginPageRes.headers);
  const initialCookies = initialSessionId ? `JSESSIONID=${initialSessionId}` : "";

  // 2. POST credentials
  const body = new URLSearchParams({ _csrf: csrfToken, email, password });
  const loginRes = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: initialCookies,
      "User-Agent": UA,
      Referer: LOGIN_URL,
      Origin: BASE_URL,
    },
    body: body.toString(),
    redirect: "manual",
  });

  if (loginRes.status !== 302) {
    throw new SchoolAppAuthError("INVALID_CREDENTIALS");
  }

  const sessionId =
    extractSessionId(loginRes.headers) ?? initialSessionId ?? "";
  const sessionCookies = `JSESSIONID=${sessionId}`;

  // 3. Load dashboard to verify auth + scrape student info
  const dashboardRes = await fetch(DASHBOARD_URL, {
    headers: { Cookie: sessionCookies, "User-Agent": UA, Referer: LOGIN_URL },
  });
  const html = await dashboardRes.text();
  const $dash = cheerio.load(html);

  const isAuthenticated =
    $dash('form[action="/login"]').length === 0 &&
    $dash('a[href*="logout"]').length > 0;

  if (!isAuthenticated) throw new SchoolAppAuthError("INVALID_CREDENTIALS");

  return { sessionId, studentInfo: extractStudentInfo(html) };
}
