-- ============================================================
-- Practice Log — Database Schema
-- ============================================================

-- 1. User role enum
CREATE TYPE user_role AS ENUM ('teacher', 'student');

-- 2. PROFILES (extends auth.users with display info)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  avatar_url  text,
  role        user_role NOT NULL DEFAULT 'student',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read profiles
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. TEACHER-STUDENT RELATIONSHIP
CREATE TABLE IF NOT EXISTS public.teacher_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_id)
);

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

-- Teachers can see and manage their own students
CREATE POLICY "Teachers manage own students"
  ON public.teacher_students FOR ALL
  USING (auth.uid() = teacher_id);

-- Students can see their own teacher relationship
CREATE POLICY "Students see own relationship"
  ON public.teacher_students FOR SELECT
  USING (auth.uid() = student_id);

-- 4. ASSIGNMENTS (teacher assigns pieces/exercises)
CREATE TABLE IF NOT EXISTS public.assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text DEFAULT '',
  due_date      date,
  score_url     text,          -- optional link to uploaded score image
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Teacher can CRUD their own assignments
CREATE POLICY "Teachers CRUD own assignments"
  ON public.assignments FOR ALL
  USING (auth.uid() = teacher_id);

-- Students can read assignments assigned to them
CREATE POLICY "Students read own assignments"
  ON public.assignments FOR SELECT
  USING (auth.uid() = student_id);

-- 5. PRACTICE LOGS (student logs practice sessions)
CREATE TABLE IF NOT EXISTS public.practice_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  duration_min  int NOT NULL DEFAULT 0,
  notes         text DEFAULT '',
  audio_url     text,          -- optional practice audio recording
  video_url     text,          -- optional practice video recording
  practiced_at  date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_logs ENABLE ROW LEVEL SECURITY;

-- Students can CRUD their own logs
CREATE POLICY "Students CRUD own logs"
  ON public.practice_logs FOR ALL
  USING (auth.uid() = student_id);

-- Teachers can read logs of their students
CREATE POLICY "Teachers read students logs"
  ON public.practice_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_students
      WHERE teacher_id = auth.uid() AND student_id = practice_logs.student_id
    )
  );

-- 6. FEEDBACK (teacher comments on practice logs)
CREATE TABLE IF NOT EXISTS public.feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_log_id uuid NOT NULL REFERENCES public.practice_logs(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Teachers create feedback on their students' logs
CREATE POLICY "Teachers CRUD feedback"
  ON public.feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_students
      WHERE teacher_id = auth.uid() AND student_id = (
        SELECT student_id FROM public.practice_logs WHERE id = feedback.practice_log_id
      )
    )
  );

-- Students can read feedback on their own logs
CREATE POLICY "Students read own feedback"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_logs
      WHERE id = feedback.practice_log_id AND student_id = auth.uid()
    )
  );

-- 7. STORAGE BUCKETS for media
-- Run these in the Supabase dashboard SQL editor too:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('scores', 'scores', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('practice_media', 'practice_media', true);
