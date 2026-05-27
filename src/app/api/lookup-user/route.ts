import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Use service_role key if available for admin user lookup
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    if (serviceRoleKey) {
      // Admin client — can look up any user by email in auth.users
      const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
        cookies: { getAll: () => [], setAll: () => {} },
      })
      const { data, error } = await adminClient.auth.admin.getUserByEmail(email)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (!data?.user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'Unknown',
        },
      })
    }

    // Fallback: query profiles (assumes email column exists in profiles table)
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll: () => [], setAll: () => {} },
      },
    )

    // Try direct profiles.email lookup
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email)
      .eq('role', 'student')
      .limit(1)

    if (profileError) {
      return NextResponse.json(
        { error: 'Email lookup unavailable. Ask your Supabase admin to add the email column to profiles, or set SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 },
      )
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'Student not found. Make sure they have signed up first.' }, { status: 404 })
    }

    return NextResponse.json({ user: profiles[0] })
  } catch (err) {
    console.error('lookup-user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
