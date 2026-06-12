/**
 * Migration: sessions v2
 * - Converts session_time from GENERATED to regular TEXT column
 * - Adds late_tolerance_minutes SMALLINT DEFAULT 10
 * - Adds custom_start_time TEXT (for custom period)
 *
 * Run: node scripts/migrate-sessions-v2.js
 * If DB_PASSWORD is missing, paste the SQL below in:
 *   https://supabase.com/dashboard/project/ydpukfubmzjrvwedchxo/editor
 */

const { Client } = require("pg");

const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcHVrZnVibXpqcnZ3ZWRjaHhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ2MDcyOCwiZXhwIjoyMDk1MDM2NzI4fQ.Jd7RCYOqLJ-LbBugTqU_1A-RG502e3IyOG-OT6S3kMM";

// Try DB_PASSWORD env var first, then fallback to service key (session pooler)
const DB_PASSWORD = process.env.DB_PASSWORD || SERVICE_KEY;

const SQL = `
-- ─── 1. Convert session_time from GENERATED → regular TEXT column ──────────
-- PostgreSQL 14+: DROP EXPRESSION keeps the stored values intact
ALTER TABLE public.sessions
  ALTER COLUMN session_time DROP EXPRESSION IF EXISTS;

-- ─── 2. Back-fill any NULL session_time rows (safety) ──────────────────────
UPDATE public.sessions
SET session_time =
  CASE WHEN "isTP" THEN
    CASE period
      WHEN 1 THEN '08:30' WHEN 2 THEN '11:30'
      WHEN 3 THEN '13:30' WHEN 4 THEN '16:30'
      ELSE '08:30' END
  ELSE
    CASE period
      WHEN 1 THEN '08:30' WHEN 2 THEN '10:30'
      WHEN 3 THEN '14:30' WHEN 4 THEN '16:30'
      ELSE '08:30' END
  END
WHERE session_time IS NULL;

-- ─── 3. Add new columns ────────────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes SMALLINT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS custom_start_time      TEXT;
`;

async function run() {
  const configs = [
    // Option 1: Session pooler with service key as password
    {
      host: "aws-0-eu-west-3.pooler.supabase.com",
      port: 5432,
      user: "postgres.ydpukfubmzjrvwedchxo",
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    },
    // Option 2: Direct DB (requires real DB password via DB_PASSWORD env var)
    {
      host: "db.ydpukfubmzjrvwedchxo.supabase.co",
      port: 5432,
      user: "postgres",
      password: DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    },
  ];

  for (const cfg of configs) {
    const client = new Client(cfg);
    try {
      await client.connect();
      console.log(`Connected via ${cfg.host}`);
      await client.query(SQL);
      console.log("✅  Migration applied successfully.");
      await client.end();
      return;
    } catch (err) {
      console.warn(`  ✗ ${cfg.host}: ${err.message}`);
      try { await client.end(); } catch {}
    }
  }

  console.error("\n❌  Could not connect. Run this SQL in the Supabase SQL Editor:");
  console.error("https://supabase.com/dashboard/project/ydpukfubmzjrvwedchxo/editor\n");
  console.log(SQL);
}

run();
