-- Fix: allow authenticated users to upsert their own profile (no service role key needed)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- Drop old restrictive policy
DROP POLICY IF EXISTS "service_can_upsert_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "students_update_own_profile"    ON public.profiles;
DROP POLICY IF EXISTS "authenticated_insert_own_profile" ON public.profiles;

-- Allow any authenticated user to INSERT a profile whose email matches their auth email
CREATE POLICY "authenticated_insert_own_profile" ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow authenticated users to UPDATE their own profile (matched by user_id or email)
CREATE POLICY "authenticated_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Service role still bypasses RLS entirely (built-in Supabase behavior — no policy needed)
