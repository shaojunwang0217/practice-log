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
      // Use the Supabase Auth Admin REST API to look up user by email
      const response = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?filter=email:eq:${encodeURIComponent(email)}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
      )

      if (!response.ok) {
        const errText = await response.text()
        console.error('Admin lookup failed:', response.status, errText)
        return NextResponse.json(
          { error: 'User lookup failed. Check SUPABASE_SERVICE_ROLE_KEY.' },
          { status: 500 },
        )
      }

      const result = await response.json()
      const users = result.users || []

      if (users.length === 0) {
        return NextResponse.json(
          { error: 'Student not found. Make sure they have signed up first.' },
          { status: 404 },
        )
      }

      const found = users[0]
      return NextResponse.json({
        user: {
          id: found.id,
          email: found.email,
          full_name: found.user_metadata?.full_name || 'Unknown',
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
