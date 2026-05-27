'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

type Assignment = {
  id: string
  title: string
  description: string
  due_date: string | null
  score_url: string | null
  created_at: string
}

type PracticeLog = {
  id: string
  assignment_id: string | null
  duration_min: number
  notes: string
  audio_url: string | null
  video_url: string | null
  practiced_at: string
}

type Teacher = {
  id: string
  full_name: string
}

export default function StudentDashboard({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showLogForm, setShowLogForm] = useState(false)
  const [logMinutes, setLogMinutes] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logAssignment, setLogAssignment] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [showScoreUpload, setShowScoreUpload] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    // Get profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(prof)

    // Get teacher
    const { data: rel } = await supabase
      .from('teacher_students')
      .select('teacher_id')
      .eq('student_id', userId)
      .single()

    if (rel) {
      const { data: t } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', rel.teacher_id)
        .single()
      if (t) setTeacher(t)

      // Get assignments
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false })
      if (assignData) setAssignments(assignData)

      // Get practice logs
      const { data: logData } = await supabase
        .from('practice_logs')
        .select('*')
        .eq('student_id', userId)
        .order('practiced_at', { ascending: false })
        .limit(20)
      if (logData) setLogs(logData)
    }

    setLoading(false)
  }

  async function logPractice() {
    const mins = parseInt(logMinutes)
    if (isNaN(mins) || mins <= 0) {
      toast.error('Please enter a valid number of minutes.')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('practice_logs').insert({
      student_id: userId,
      assignment_id: logAssignment || null,
      duration_min: mins,
      notes: logNotes,
      practiced_at: logDate,
    })

    if (error) {
      toast.error('Failed to log practice: ' + error.message)
      setLoading(false)
      return
    }

    toast.success('Practice logged! 🎉')
    setLogMinutes('')
    setLogNotes('')
    setLogAssignment('')
    setLogDate(new Date().toISOString().split('T')[0])
    setShowLogForm(false)
    loadData()
  }

  async function uploadScore(assignmentId: string) {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Please select a file.')
      return
    }

    setLoading(true)
    const filePath = `scores/${userId}/${assignmentId}/${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('scores')
      .upload(filePath, file)

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('scores')
      .getPublicUrl(filePath)

    // Update assignment with score URL
    const { error: updateError } = await supabase
      .from('assignments')
      .update({ score_url: publicUrl })
      .eq('id', assignmentId)

    if (updateError) {
      toast.error('Failed to link score: ' + updateError.message)
    } else {
      toast.success('Score uploaded!')
    }

    setShowScoreUpload(null)
    loadData()
  }

  async function uploadMedia(type: 'audio' | 'video', logId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'audio' ? 'audio/*' : 'video/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      const filePath = `practice_media/${userId}/${logId}/${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('practice_media')
        .upload(filePath, file)

      if (uploadError) {
        toast.error('Upload failed: ' + uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('practice_media')
        .getPublicUrl(filePath)

      const updateField = type === 'audio' ? { audio_url: publicUrl } : { video_url: publicUrl }
      const { error: updateError } = await supabase
        .from('practice_logs')
        .update(updateField)
        .eq('id', logId)

      if (updateError) {
        toast.error('Failed to link media: ' + updateError.message)
      } else {
        toast.success(`${type === 'audio' ? 'Audio' : 'Video'} uploaded!`)
        loadData()
      }
    }
    input.click()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Stats
  const totalMinutes = logs.reduce((sum, l) => sum + l.duration_min, 0)
  const streak = calculateStreak(logs)
  const thisWeek = logs.filter(l => {
    const d = new Date(l.practiced_at)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }).length

  if (loading && assignments.length === 0 && logs.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading your practice dashboard…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Practice Log 🎻</h1>
          <div className="flex items-center gap-3">
            {profile && <span className="text-sm text-muted-foreground">{profile.full_name}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        {teacher && (
          <p className="text-sm text-muted-foreground">
            Your teacher: <span className="font-medium">{teacher.full_name}</span>
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Practice</CardDescription>
              <CardTitle className="text-3xl">{totalMinutes}m</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Week</CardDescription>
              <CardTitle className="text-3xl">{thisWeek} day{thisWeek !== 1 ? 's' : ''}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Streak</CardDescription>
              <CardTitle className="text-3xl">{streak} day{streak !== 1 ? 's' : ''}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Log Practice Button */}
        <Button
          className="w-full py-6 text-lg"
          onClick={() => setShowLogForm(!showLogForm)}
        >
          {showLogForm ? 'Cancel' : '✏️ Log Practice'}
        </Button>

        {showLogForm && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Minutes practiced"
                  value={logMinutes}
                  onChange={(e) => setLogMinutes(e.target.value)}
                  min={1}
                />
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={logAssignment}
                onChange={(e) => setLogAssignment(e.target.value)}
              >
                <option value="">No specific assignment</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <Input
                placeholder="Notes about this practice session (optional)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
              />
              <Button onClick={logPractice} disabled={loading} className="w-full">
                Save Practice Log
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>Pieces and exercises from your teacher</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div key={a.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{a.title}</h3>
                        {a.description && (
                          <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                        )}
                        {a.due_date && (
                          <p className="text-xs text-muted-foreground mt-1">Due: {a.due_date}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {a.score_url ? (
                          <a
                            href={a.score_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">📄 Score</Button>
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowScoreUpload(showScoreUpload === a.id ? null : a.id)}
                          >
                            🖼 Upload Score
                          </Button>
                        )}
                      </div>
                    </div>
                    {showScoreUpload === a.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                        />
                        <Button size="sm" onClick={() => uploadScore(a.id)} disabled={loading}>Upload</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Practice History */}
        <Card>
          <CardHeader>
            <CardTitle>Practice History</CardTitle>
            <CardDescription>Your recent practice sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practice logged yet. Start your first entry above!</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{log.duration_min} min</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {new Date(log.practiced_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {log.audio_url && (
                          <a href={log.audio_url} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="cursor-pointer">🎵 Audio</Badge>
                          </a>
                        )}
                        {log.video_url && (
                          <a href={log.video_url} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="cursor-pointer">🎬 Video</Badge>
                          </a>
                        )}
                        {!log.audio_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => uploadMedia('audio', log.id)}
                          >
                            + Audio
                          </Button>
                        )}
                        {!log.video_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => uploadMedia('video', log.id)}
                          >
                            + Video
                          </Button>
                        )}
                      </div>
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

function calculateStreak(logs: PracticeLog[]): number {
  if (logs.length === 0) return 0

  const dates = [...new Set(logs.map(l => l.practiced_at))].sort().reverse()
  let streak = 1
  const today = new Date().toISOString().split('T')[0]

  // If most recent log isn't today or yesterday, streak is 0
  const mostRecent = dates[0]
  const diff = Math.floor(
    (new Date(today).getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff > 1) return 0

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const dayDiff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
    if (dayDiff === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}
