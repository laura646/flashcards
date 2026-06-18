'use client'
// Phase/Tier-1 harness for the LessonAudioPlayer. Not linked; delete with previews.
import LessonAudioPlayer from '@/components/student-ui/LessonAudioPlayer'

export default function AudioPreview() {
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-10">
      <div className="max-w-lg mx-auto">
        <h2 className="text-sm font-extrabold text-brandblue mb-3">Listen &amp; Understand — audio player</h2>
        <LessonAudioPlayer src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" />
      </div>
    </main>
  )
}
