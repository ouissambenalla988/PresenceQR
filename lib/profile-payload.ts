import type { StudentInfo } from "@/lib/scrapper";

/**
 * Builds the `profiles` row from scraped SchoolApp student info.
 * Stores the well-known columns + the ENTIRE scraped object in `details` (JSONB),
 * so every field SchoolApp exposes is persisted without schema churn.
 */
export function buildProfilePayload(studentInfo: StudentInfo, userId?: string) {
  // Niveau is like "4A" / "4ème Année" → store the integer year
  const yearInt = parseSchoolYear(studentInfo.Niveau);

  const payload: Record<string, unknown> = {
    email: (studentInfo.Email || "").toLowerCase() || undefined,
    code: studentInfo.Code || null,
    name: studentInfo.name || `${studentInfo.Prénom ?? ""} ${studentInfo.Nom ?? ""}`.trim() || "—",
    nom: studentInfo.Nom || null,
    prenom: studentInfo.Prénom || null,
    filiere: studentInfo["Filière"] || null,
    section: studentInfo.Section || null,
    year: yearInt,
    group_name: studentInfo.Groupe || null,
    subgroup: studentInfo["Sous Groupe"] || null,
    details: studentInfo as unknown as Record<string, unknown>, // ALL scraped fields
  };

  if (userId) payload.user_id = userId;
  return payload;
}

/** "4A" | "4ème Année" | "4" → 4 ; otherwise null */
export function parseSchoolYear(niveau: string | null | undefined): number | null {
  if (!niveau) return null;
  const digits = niveau.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Reconstruct the SchoolApp niveau code ("4A") from the stored integer year. */
export function yearToNiveau(year: number | null | undefined): string {
  return year ? `${year}A` : "";
}
