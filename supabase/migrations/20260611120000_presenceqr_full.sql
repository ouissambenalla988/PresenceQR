-- =====================================================================
-- PresenceQR — Authoritative schema (run in Supabase SQL Editor)
-- Project: ydpukfubmzjrvwedchxo
--
-- Safe to re-run. Preserves data in `profiles` and `courses` (ALTER),
-- rebuilds `sessions` / `attendance` / `student_courses` to match the
-- application code (web + Flutter).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. PROFILES  (students) — keep existing rows, add missing columns
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS code              TEXT,
  ADD COLUMN IF NOT EXISTS nom               TEXT,
  ADD COLUMN IF NOT EXISTS prenom            TEXT,
  ADD COLUMN IF NOT EXISTS filiere           TEXT,
  ADD COLUMN IF NOT EXISTS section           TEXT,
  ADD COLUMN IF NOT EXISTS group_name        TEXT,
  ADD COLUMN IF NOT EXISTS subgroup          TEXT,
  ADD COLUMN IF NOT EXISTS year              INTEGER,
  ADD COLUMN IF NOT EXISTS details           JSONB,                 -- ALL scraped SchoolApp fields
  ADD COLUMN IF NOT EXISTS schoolapp_session TEXT,
  ADD COLUMN IF NOT EXISTS schoolapp_creds   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- year may have been created as INTEGER previously; ensure it accepts ints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='year' AND data_type <> 'integer'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN year TYPE INTEGER
      USING NULLIF(regexp_replace(year::text, '\D', '', 'g'), '')::INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx   ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_section_idx ON public.profiles(section);

-- ─────────────────────────────────────────────────────────────────────
-- 2. STAFF  (teachers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT UNIQUE,
  role       TEXT DEFAULT 'teacher',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_user_id_idx ON public.staff(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. COURSES — keep existing rows; relax NOT NULL, add columns
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.courses ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS filiere    TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- 4. STUDENT_COURSES  (enrollment) — rebuild
-- ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.student_courses CASCADE;
CREATE TABLE public.student_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL,          -- course CODE (e.g. "IA41")
  section     TEXT,                   -- student's section at enrollment time
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
CREATE INDEX student_courses_user_idx   ON public.student_courses(user_id);
CREATE INDEX student_courses_course_idx ON public.student_courses(course_id);

-- ─────────────────────────────────────────────────────────────────────
-- 5. SESSIONS — rebuild (matches web + Flutter)
-- ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.sessions   CASCADE;

CREATE TABLE public.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courses_id    TEXT NOT NULL,                       -- course CODE
  teacher_id    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  "isTP"        BOOLEAN DEFAULT FALSE,
  period        SMALLINT NOT NULL,
  class         TEXT NOT NULL,                        -- section, e.g. "sec8"
  room          TEXT,
  event         TEXT DEFAULT 'roll'   CHECK (event  IN ('roll','presentation','both')),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  qr_token      UUID UNIQUE DEFAULT gen_random_uuid(),
  qr_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 seconds'),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- Generated columns consumed by the Flutter app
  session_date  DATE GENERATED ALWAYS AS (date) STORED,
  session_time  TEXT GENERATED ALWAYS AS (
    CASE WHEN "isTP" THEN
      CASE period WHEN 1 THEN '08:30' WHEN 2 THEN '11:30'
                  WHEN 3 THEN '13:30' WHEN 4 THEN '16:30' ELSE '08:30' END
    ELSE
      CASE period WHEN 1 THEN '08:30' WHEN 2 THEN '10:30'
                  WHEN 3 THEN '14:30' WHEN 4 THEN '16:30' ELSE '08:30' END
    END
  ) STORED
);
CREATE INDEX sessions_date_idx     ON public.sessions(date);
CREATE INDEX sessions_class_idx    ON public.sessions(class);
CREATE INDEX sessions_course_idx   ON public.sessions(courses_id);
CREATE INDEX sessions_qr_token_idx ON public.sessions(qr_token);

-- ─────────────────────────────────────────────────────────────────────
-- 6. ATTENDANCE — rebuild
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  qr_scanned BOOLEAN DEFAULT FALSE,
  marked_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX attendance_session_idx ON public.attendance(session_id);
CREATE INDEX attendance_student_idx ON public.attendance(student_id);

-- ─────────────────────────────────────────────────────────────────────
-- 7. WIFI_AVAILABLE  (used by the Flutter app)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wifi_available (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ssid            TEXT NOT NULL,
  ip_address      TEXT,
  gateway_ip      TEXT,
  signal_strength INTEGER DEFAULT 0,
  is_authorized   BOOLEAN DEFAULT TRUE,
  wifi_available  BOOLEAN DEFAULT TRUE,
  location        TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- 8. ROSTER FUNCTION — enrolled students of a session's course+section
--    with their present/absent status. SECURITY DEFINER so a teacher can
--    read student profiles that RLS would otherwise hide.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_session_roster(p_session_id UUID)
RETURNS TABLE (
  student_id UUID,
  code       TEXT,
  nom        TEXT,
  prenom     TEXT,
  section    TEXT,
  status     TEXT,
  qr_scanned BOOLEAN,
  marked_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT courses_id, class FROM public.sessions WHERE id = p_session_id
  )
  SELECT
    p.id                                   AS student_id,
    p.code,
    COALESCE(p.nom,    '')                 AS nom,
    COALESCE(p.prenom, p.name, '')         AS prenom,
    p.section,
    COALESCE(a.status, 'absent')           AS status,
    COALESCE(a.qr_scanned, FALSE)          AS qr_scanned,
    a.marked_at
  FROM public.student_courses sc
  JOIN s ON sc.course_id = s.courses_id
  JOIN public.profiles p ON p.user_id = sc.user_id
  LEFT JOIN public.attendance a
         ON a.session_id = p_session_id AND a.student_id = p.id
  -- match section by digits ("sec8" = "Section 8" = "8"); include if either side blank
  WHERE
    NULLIF(regexp_replace(COALESCE(p.section,''), '\D', '', 'g'), '') IS NOT DISTINCT FROM
    NULLIF(regexp_replace(COALESCE(s.class,''),   '\D', '', 'g'), '')
    OR COALESCE(p.section,'') = ''
    OR COALESCE(s.class,'')   = ''
  ORDER BY p.nom, p.prenom;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_roster(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_available  ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_read_own   ON public.profiles;
DROP POLICY IF EXISTS profiles_read_staff  ON public.profiles;
DROP POLICY IF EXISTS profiles_service_all ON public.profiles;
CREATE POLICY profiles_read_own   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY profiles_read_staff ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()));
CREATE POLICY profiles_service_all ON public.profiles FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- staff
DROP POLICY IF EXISTS staff_read_own    ON public.staff;
DROP POLICY IF EXISTS staff_service_all ON public.staff;
CREATE POLICY staff_read_own    ON public.staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY staff_service_all ON public.staff FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- courses (any authenticated user can read; service writes)
DROP POLICY IF EXISTS courses_read_all   ON public.courses;
DROP POLICY IF EXISTS courses_service_all ON public.courses;
CREATE POLICY courses_read_all   ON public.courses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY courses_service_all ON public.courses FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- student_courses
DROP POLICY IF EXISTS sc_read_own    ON public.student_courses;
DROP POLICY IF EXISTS sc_insert_own  ON public.student_courses;
DROP POLICY IF EXISTS sc_service_all ON public.student_courses;
CREATE POLICY sc_read_own   ON public.student_courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sc_insert_own ON public.student_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sc_service_all ON public.student_courses FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- sessions
DROP POLICY IF EXISTS sessions_teacher_all  ON public.sessions;
DROP POLICY IF EXISTS sessions_student_read ON public.sessions;
DROP POLICY IF EXISTS sessions_service_all  ON public.sessions;
CREATE POLICY sessions_teacher_all ON public.sessions FOR ALL
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
-- students may read active sessions for their own section
CREATE POLICY sessions_student_read ON public.sessions FOR SELECT
  USING (
    status = 'active'
    AND NULLIF(regexp_replace(COALESCE(class,''), '\D', '', 'g'), '') IN (
      SELECT NULLIF(regexp_replace(COALESCE(section,''), '\D', '', 'g'), '')
      FROM public.profiles WHERE user_id = auth.uid()
    )
  );
CREATE POLICY sessions_service_all ON public.sessions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- attendance
DROP POLICY IF EXISTS att_student_insert ON public.attendance;
DROP POLICY IF EXISTS att_student_read   ON public.attendance;
DROP POLICY IF EXISTS att_teacher_read   ON public.attendance;
DROP POLICY IF EXISTS att_service_all    ON public.attendance;
CREATE POLICY att_student_insert ON public.attendance FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY att_student_read ON public.attendance FOR SELECT
  USING (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY att_teacher_read ON public.attendance FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));
CREATE POLICY att_service_all ON public.attendance FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- wifi_available
DROP POLICY IF EXISTS wifi_read_auth   ON public.wifi_available;
DROP POLICY IF EXISTS wifi_service_all ON public.wifi_available;
CREATE POLICY wifi_read_auth   ON public.wifi_available FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY wifi_service_all ON public.wifi_available FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 11. QR auto-refresh helper (optional): bump token + expiry
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_session_qr(p_session_id UUID)
RETURNS TABLE (qr_token UUID, qr_expires_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sessions
     SET qr_token = gen_random_uuid(),
         qr_expires_at = NOW() + INTERVAL '30 seconds'
   WHERE id = p_session_id
     AND teacher_id = auth.uid()
  RETURNING qr_token, qr_expires_at;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_session_qr(UUID) TO authenticated;
