-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing rows with email from auth.users (one-time migration)
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Allow teachers to look up students by email (for adding students)
CREATE POLICY "Allow email lookup for authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() IS NOT NULL);
