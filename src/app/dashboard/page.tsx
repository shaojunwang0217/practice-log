import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TeacherDashboard from './teacher-dashboard'
import StudentDashboard from './student-dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/signup')

  if (profile.role === 'teacher') {
    return <TeacherDashboard userId={user.id} />
  }

  return <StudentDashboard userId={user.id} />
}
