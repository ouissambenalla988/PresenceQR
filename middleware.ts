import type { NextRequest } from "next/server";

import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/courses/:path*",
    "/sessions/:path*",
    "/settings",
    "/sign-in",
    "/sign-up",
    "/sign-up/teacher",
  ],
};
