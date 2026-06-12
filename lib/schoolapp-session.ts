import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-cbc";

function getKey(): Buffer {
  const secret =
    process.env.SCHOOLAPP_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "fallback-key-change-in-production";
  return scryptSync(secret, "sa-creds-salt", 32);
}

export function encryptCreds(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptCreds(payload: string): string {
  const sep = payload.indexOf(":");
  if (sep === -1) throw new Error("Invalid creds payload");
  const iv = Buffer.from(payload.slice(0, sep), "hex");
  const enc = Buffer.from(payload.slice(sep + 1), "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Cookie names */
export const SID_COOKIE = "sa_sid";
export const CREDS_COOKIE = "sa_creds";

/** Options for the session-id cookie (expires with browser or 8h) */
export const sidCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

/** Options for the credentials cookie (30 days) */
export const credsCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
