-- Add role column to auth.users (needs dashboard SQL editor)
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'student';
