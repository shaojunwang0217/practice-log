import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  const results: string[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          status: 'manual_required',
          message:
            'No SUPABASE_SERVICE_ROLE_KEY set. To run the migration manually:\n' +
            '1. Go to https://supabase.com/dashboard/project/avhbaejsitprtsuhricz/sql/new\n' +
            '2. Paste and run the contents of supabase-fix-email.sql\n\n' +
            'Or set SUPABASE_SERVICE_ROLE_KEY in .env.local and call this endpoint again.',
          sql: `-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing rows with email from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Allow teachers to look up students by email
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow email lookup for authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() IS NOT NULL);`,
        },
        { status: 200 },
      )
    }

    // Try running via admin client's SQL capabilities
    // We use the raw Postgres query via Supabase's REST API SQL endpoint
    const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    })

    // Use rpc to execute SQL via a helper, or run directly
    // Option: execute raw SQL via Postgres connection
    const sql = `
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
      UPDATE public.profiles p SET email = au.email
        FROM auth.users au WHERE p.id = au.id AND p.email IS NULL;
      CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
    `

    // Try using rpc with pgmoon-type function if available
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql })

    if (error) {
      results.push(`RPC exec_sql failed: ${error.message}`)
      // Fallback: try direct SQL via the database URL
      results.push(
        'Unable to run SQL via API. Please run supabase-fix-email.sql manually in the Supabase Dashboard SQL Editor.',
      )
      return NextResponse.json({ status: 'failed', results, manual_sql: sql }, { status: 200 })
    }

    results.push('Migration completed successfully: email column added to profiles.')
    return NextResponse.json({ status: 'success', results }, { status: 200 })
  } catch (err) {
    console.error('Migration error:', err)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Migration failed: ' + String(err),
        manual_instructions:
          'Run the contents of supabase-fix-email.sql in the Supabase Dashboard SQL Editor.',
      },
      { status: 500 },
    )
  }
}
