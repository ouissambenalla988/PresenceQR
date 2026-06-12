import * as cheerio from "cheerio";
import { extractStudyPlan } from "@/lib/scrapper";

const BASE_URL = "https://schoolapp.ensam-umi.ac.ma";
const MODULES_URL = `${BASE_URL}/plan-etudes-view/modules`;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

// Semestres par niveau
const NIVEAU_SEMESTERS: Record<string, string[]> = {
  "1A": ["S1", "S2"],
  "2A": ["S3", "S4"],
  "3A": ["S5", "S6"],
  "4A": ["S7", "S8"],
  "5A": ["S9", "S10"],
};

// ----------------------------------------------------------------
// Scrape course codes from /student/inscriptioncours
// ----------------------------------------------------------------
export function scrapeStudentCourseCodes(html: string): string[] {
  const $ = cheerio.load(html);

  // Primary: find table with "codeelem" header
  const courseTable = $("table").filter((_, table) => {
    const headerText = $(table)
      .find("thead th")
      .toArray()
      .map((th) => $(th).text().trim().toLowerCase())
      .join("|");
    return headerText.includes("codeelem");
  });

  if (courseTable.length > 0) {
    const codes = courseTable
      .find("tbody tr")
      .map((_, row) => $(row).find("td").first().text().trim())
      .get()
      .filter(Boolean);
    return Array.from(new Set(codes));
  }

  // Fallback: any table whose first-column values look like course codes (uppercase+digits)
  const codes: string[] = [];
  $("table tbody tr").each((_, row) => {
    const firstCell = $(row).find("td").first().text().trim();
    if (/^[A-Z0-9_\-]{3,20}$/.test(firstCell)) {
      codes.push(firstCell);
    }
  });
  return Array.from(new Set(codes));
}

// ----------------------------------------------------------------
// Enrich course codes with their Intitulé from the study plan
// ----------------------------------------------------------------
export interface CourseWithName {
  code: string;
  name: string | null;
  department: string | null;
}

export async function enrichCoursesWithNames(params: {
  courseCodes: string[];
  niveau: string;
  filiere: string;
  sessionId: string;
}): Promise<CourseWithName[]> {
  const { courseCodes, niveau, filiere, sessionId } = params;

  if (courseCodes.length === 0) return [];

  const semesters = NIVEAU_SEMESTERS[niveau] ?? [
    "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8",
  ];

  const codeToName = new Map<string, string>();
  let csrfToken = "";

  // GET initial page → CSRF + first batch of modules
  try {
    const res = await fetch(MODULES_URL, {
      headers: { Cookie: `JSESSIONID=${sessionId}`, "User-Agent": UA },
    });
    if (!res.ok) return fallback(courseCodes, filiere);

    const plan = extractStudyPlan(await res.text());
    csrfToken = plan.csrfToken;
    harvestPlan(plan, codeToName);
  } catch {
    return fallback(courseCodes, filiere);
  }

  // POST each semester until all codes are resolved
  for (const semestre of semesters) {
    if (allFound(courseCodes, codeToName)) break;

    try {
      const body = new URLSearchParams({ niveau, filiere, semestre, _csrf: csrfToken });
      const res = await fetch(MODULES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `JSESSIONID=${sessionId}`,
          "User-Agent": UA,
        },
        body: body.toString(),
      });

      if (!res.ok) continue;

      const plan = extractStudyPlan(await res.text());
      if (plan.csrfToken) csrfToken = plan.csrfToken; // renew for next request
      harvestPlan(plan, codeToName);
    } catch {
      continue;
    }
  }

  return courseCodes.map((code) => ({
    code,
    name: codeToName.get(code) ?? null,
    department: filiere || null,
  }));
}

// ----------------------------------------------------------------
// Scrape ALL courses for a given filiere/niveau from the study plan
// (used by the seed endpoint)
// ----------------------------------------------------------------
export async function scrapeAllCoursesForFiliere(params: {
  niveau: string;
  filiere: string;
  sessionId: string;
}): Promise<CourseWithName[]> {
  const { niveau, filiere, sessionId } = params;
  const semesters = NIVEAU_SEMESTERS[niveau] ?? [];
  const codeToName = new Map<string, string>();
  let csrfToken = "";

  try {
    const res = await fetch(MODULES_URL, {
      headers: { Cookie: `JSESSIONID=${sessionId}`, "User-Agent": UA },
    });
    if (!res.ok) return [];
    const plan = extractStudyPlan(await res.text());
    csrfToken = plan.csrfToken;
    harvestPlan(plan, codeToName);
  } catch {
    return [];
  }

  for (const semestre of semesters) {
    try {
      const body = new URLSearchParams({ niveau, filiere, semestre, _csrf: csrfToken });
      const res = await fetch(MODULES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `JSESSIONID=${sessionId}`,
          "User-Agent": UA,
        },
        body: body.toString(),
      });
      if (!res.ok) continue;
      const plan = extractStudyPlan(await res.text());
      if (plan.csrfToken) csrfToken = plan.csrfToken;
      harvestPlan(plan, codeToName);
    } catch {
      continue;
    }
  }

  return Array.from(codeToName.entries()).map(([code, name]) => ({
    code,
    name,
    department: filiere,
  }));
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function harvestPlan(plan: ReturnType<typeof extractStudyPlan>, map: Map<string, string>) {
  for (const mod of plan.modules) {
    if (mod.codeMod && mod.intitule) map.set(mod.codeMod, mod.intitule);
    for (const el of mod.elements) {
      if (el.codeElem && el.intitule) map.set(el.codeElem, el.intitule);
    }
  }
}

function allFound(codes: string[], map: Map<string, string>) {
  return codes.every((c) => map.has(c));
}

function fallback(codes: string[], filiere: string): CourseWithName[] {
  return codes.map((code) => ({ code, name: null, department: filiere }));
}
