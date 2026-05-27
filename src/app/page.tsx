import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-5xl font-bold mb-4">Practice Log 🎻</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-lg">
        Keep track of your violin practice. Teachers assign pieces, students log sessions, progress happens.
      </p>
      <div className="flex gap-4">
        <Link href="/signup">
          <Button size="lg">Get Started</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">Sign In</Button>
        </Link>
      </div>
    </div>
  )
}
