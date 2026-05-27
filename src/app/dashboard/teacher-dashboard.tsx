'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type Student = {
  id: string
  full_name: string
}

type Assignment = {
  id: string
  title: string
  description: string
  due_date: string | null
  student_id: string
  student_name: string
  score_url: string | null
  created_at: string
}

export default function TeacherDashboard({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [studentEmail, setStudentEmail] = useState('')
  const [showNewAssignment, setShowNewAssignment] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentDesc, setAssignmentDesc] = useState('')
  const [assignmentDue, setAssignmentDue] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    // Get students
    const { data: relations } = await supabase
      .from('teacher_students')
      .select('student_id')
      .eq('teacher_id', userId)

    if (relations && relations.length > 0) {
      const studentIds = relations.map(r => r.student_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)

      const studentList = (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
      }))

      setStudents(studentList)

      // Get assignments for these students
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false })

      if (assignData) {
        const enriched = assignData.map(a => ({
          ...a,
          student_name: studentList.find(s => s.id === a.student_id)?.full_name || 'Unknown',
        }))
        setAssignments(enriched)
      }

      // Get recent practice logs
      const { data: logs } = await supabase
        .from('practice_logs')
        .select('*')
        .in('student_id', studentIds)
        .order('practiced_at', { ascending: false })
        .limit(10)

      if (logs) {
        const enriched = logs.map(l => ({
          ...l,
          student_name: studentList.find(s => s.id === l.student_id)?.full_name || 'Unknown',
        }))
        setRecentLogs(enriched)
      }
    }

    setLoading(false)
  }

  async function addStudent() {
    if (!studentEmail.trim()) return

    setLoading(true)

    // Look up student by email via server API route
    const res = await fetch('/api/lookup-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: studentEmail.trim().toLowerCase() }),
    })
    const data = await res.json()

    if (!res.ok || !data.user) {
      toast.error(data.error || 'Student not found. Make sure they have signed up first.')
      setLoading(false)
      setStudentEmail('')
      setShowAddStudent(false)
      return
    }

    const { error: relError } = await supabase
      .from('teacher_students')
      .insert({ teacher_id: userId, student_id: data.user.id })

    if (relError) {
      if (relError.code === '23505') {
        toast.error('This student is already in your roster.')
      } else {
        toast.error('Failed to add student: ' + relError.message)
      }
      setLoading(false)
      return
    }

    toast.success(`${data.user.full_name} added to your roster!`)
    setStudentEmail('')
    setShowAddStudent(false)
    loadData()
  }

  async function createAssignment() {
    if (!selectedStudent || !assignmentTitle.trim()) {
      toast.error('Please select a student and enter a title.')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('assignments').insert({
      teacher_id: userId,
      student_id: selectedStudent,
      title: assignmentTitle,
      description: assignmentDesc,
      due_date: assignmentDue || null,
    })

    if (error) {
      toast.error('Failed to create assignment: ' + error.message)
      setLoading(false)
      return
    }

    toast.success('Assignment created!')
    setSelectedStudent('')
    setAssignmentTitle('')
    setAssignmentDesc('')
    setAssignmentDue('')
    setShowNewAssignment(false)
    loadData()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const today = recentLogs.filter(l =>
    new Date(l.practiced_at).toDateString() === new Date().toDateString()
  ).length

  const weekMin = recentLogs
    .filter(l => {
      const d = new Date(l.practiced_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return d >= weekAgo
    })
    .reduce((sum, l) => sum + (l.duration_min || 0), 0)

  if (loading && students.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading your dashboard…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Practice Log 🎻</h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Teacher</Badge>
            <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Students</CardDescription>
              <CardTitle className="text-3xl">{students.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Practice Today</CardDescription>
              <CardTitle className="text-3xl">{today}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Minutes (7 days)</CardDescription>
              <CardTitle className="text-3xl">{weekMin}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Students Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Students</CardTitle>
              <CardDescription>{students.length} student{students.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <Button onClick={() => setShowAddStudent(!showAddStudent)}>
              {showAddStudent ? 'Cancel' : '+ Add Student'}
            </Button>
          </CardHeader>
          <CardContent>
            {showAddStudent && (
              <div className="flex gap-2 mb-4">
                <Input
                  type="email"
                  placeholder="student@email.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                />
                <Button onClick={addStudent} disabled={loading}>Add</Button>
              </div>
            )}
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students yet. Add a student to get started!
              </p>
            ) : (
              <div className="space-y-2">
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="font-medium">{s.full_name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Assignment */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Assignments</CardTitle>
              <CardDescription>Pieces and exercises for your students</CardDescription>
            </div>
            <Button onClick={() => setShowNewAssignment(!showNewAssignment)}>
              {showNewAssignment ? 'Cancel' : '+ New Assignment'}
            </Button>
          </CardHeader>
          <CardContent>
            {showNewAssignment && (
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-muted/50">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">Select a student…</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
                <Input
                  placeholder="Assignment title (e.g. Bach Double, Scale in G)"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                />
                <Input
                  placeholder="Notes / instructions (optional)"
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={assignmentDue}
                    onChange={(e) => setAssignmentDue(e.target.value)}
                  />
                  <Button onClick={createAssignment} disabled={loading}>Create</Button>
                </div>
              </div>
            )}
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-start justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">{a.title}</span>
                      <span className="text-sm text-muted-foreground ml-2">— {a.student_name}</span>
                      {a.due_date && (
                        <p className="text-xs text-muted-foreground">Due: {a.due_date}</p>
                      )}
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Practice Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Practice</CardTitle>
            <CardDescription>Latest practice activity from your students</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practice logged yet.</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map(log => (
                  <div key={log.id} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.student_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {log.duration_min} min · {new Date(log.practiced_at).toLocaleDateString()}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
