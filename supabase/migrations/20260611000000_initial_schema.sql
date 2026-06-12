-- PresenceQR — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Project: ydpukfubmzjrvwedchxo

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  code         TEXT,
  name         TEXT        NOT NULL,
  email        TEXT        UNIQUE NOT NULL,
  filiere      TEXT,
  section      TEXT,
  group_name   TEXT,
  subgroup     TEXT,
  year         TEXT,
  status       TEXT        DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx   ON public.profiles(email);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.instructors (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  email      TEXT        UNIQUE NOT NULL,
  role       TEXT        DEFAULT 'instructor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS instructors_user_id_idx ON public.instructors(user_id);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.courses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  instructor_id UUID        REFERENCES public.instructors(id) ON DELETE SET NULL,
  filiere       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID        REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id  UUID        REFERENCES public.instructors(id) ON DELETE SET NULL,
  session_date   DATE        NOT NULL,
  session_time   TIME        NOT NULL,
  is_tp          BOOLEAN     DEFAULT FALSE,
  period         SMALLINT,
  room           TEXT,
  qr_token       TEXT        UNIQUE,
  qr_expires_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_date_idx     ON public.sessions(session_date);
CREATE INDEX IF NOT EXISTS sessions_qr_token_idx ON public.sessions(qr_token);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.sessions(id)  ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  marked_at   TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT        DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  qr_scanned  BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS attendance_session_idx ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS attendance_student_idx ON public.attendance(student_id);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_courses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT auth.uid()
                          REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   TEXT        NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wifi_available (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ssid            TEXT        NOT NULL,
  ip_address      TEXT,
  gateway_ip      TEXT,
  signal_strength INTEGER     DEFAULT 0,
  is_authorized   BOOLEAN     DEFAULT TRUE,
  wifi_available  BOOLEAN     DEFAULT TRUE,
  location        TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.attendance_summary AS
SELECT
  p.id                                                           AS student_id,
  p.name                                                         AS student_name,
  p.code                                                         AS student_code,
  p.filiere,
  p.group_name,
  c.name                                                         AS course_name,
  c.code                                                         AS course_code,
  COUNT(a.id)                                                    AS total_sessions_attended,
  COUNT(CASE WHEN a.status = 'present' THEN 1 END)               AS present_count,
  COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)               AS absent_count,
  COUNT(CASE WHEN a.status = 'late'    THEN 1 END)               AS late_count
FROM public.profiles p
JOIN public.student_courses sc ON sc.user_id = p.user_id
LEFT JOIN public.courses    c  ON c.code = sc.course_id
LEFT JOIN public.sessions   s  ON s.course_id = c.id
LEFT JOIN public.attendance a  ON a.session_id = s.id AND a.student_id = p.id
GROUP BY p.id, p.name, p.code, p.filiere, p.group_name, c.name, c.code;

-- ============================================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at    ON public.profiles;
DROP TRIGGER IF EXISTS wifi_updated_at        ON public.wifi_available;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER wifi_updated_at
  BEFORE UPDATE ON public.wifi_available
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_available  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "students_read_own_profile"    ON public.profiles;
DROP POLICY IF EXISTS "instructors_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "service_can_upsert_profiles"   ON public.profiles;

CREATE POLICY "students_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "instructors_read_all_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid())
  );

-- Service role bypass (used by /api/schoolapp-connection)
CREATE POLICY "service_can_upsert_profiles" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── instructors ───────────────────────────────────────────────
DROP POLICY IF EXISTS "instructors_read_own"          ON public.instructors;
DROP POLICY IF EXISTS "service_can_upsert_instructors" ON public.instructors;

CREATE POLICY "instructors_read_own" ON public.instructors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_can_upsert_instructors" ON public.instructors
  FOR ALL USING (auth.role() = 'service_role');

-- ── courses ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_courses"        ON public.courses;
DROP POLICY IF EXISTS "instructors_manage_courses" ON public.courses;

CREATE POLICY "auth_read_courses" ON public.courses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "instructors_manage_courses" ON public.courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid())
  );

-- ── sessions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_sessions"          ON public.sessions;
DROP POLICY IF EXISTS "instructors_manage_sessions"  ON public.sessions;

CREATE POLICY "auth_read_sessions" ON public.sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "instructors_manage_sessions" ON public.sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid())
  );

-- ── attendance ────────────────────────────────────────────────
DROP POLICY IF EXISTS "students_read_own_attendance"   ON public.attendance;
DROP POLICY IF EXISTS "students_insert_own_attendance"  ON public.attendance;
DROP POLICY IF EXISTS "instructors_read_all_attendance" ON public.attendance;
DROP POLICY IF EXISTS "instructors_update_attendance"   ON public.attendance;

CREATE POLICY "students_read_own_attendance" ON public.attendance
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "students_insert_own_attendance" ON public.attendance
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "instructors_read_all_attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid())
  );

CREATE POLICY "instructors_update_attendance" ON public.attendance
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.instructors WHERE user_id = auth.uid())
  );

-- ── student_courses ───────────────────────────────────────────
DROP POLICY IF EXISTS "students_read_own_enrollments"  ON public.student_courses;
DROP POLICY IF EXISTS "instructors_manage_enrollments"  ON public.student_courses;
DROP POLICY IF EXISTS "service_manage_enrollments"      ON public.student_courses;

CREATE POLICY "students_read_own_enrollments" ON public.student_courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "students_insert_own_enrollments" ON public.student_courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_manage_enrollments" ON public.student_courses
  FOR ALL USING (auth.role() = 'service_role');

-- ── wifi_available ────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_wifi"    ON public.wifi_available;
DROP POLICY IF EXISTS "service_manage_wifi" ON public.wifi_available;

CREATE POLICY "auth_read_wifi" ON public.wifi_available
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_manage_wifi" ON public.wifi_available
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 6. VERIFICATION QUERIES (run separately to confirm)
-- ============================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public';
-- SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
