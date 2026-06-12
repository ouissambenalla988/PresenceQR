import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key || (!key.startsWith("eyJ") && !key.startsWith("sb_secret_"))) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing or invalid. " +
        "Get it from: Supabase Dashboard → Project Settings → API → Service Role Key",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
