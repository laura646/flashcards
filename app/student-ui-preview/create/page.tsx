'use client'

// Wave 0 verification harness for CreateChooser. Not linked; delete with the
// other preview routes on sign-off.

import { useState } from 'react'
import CreateChooser, { CreateSource } from '@/components/student-ui/CreateChooser'

export default function CreateChooserPreview() {
  const [log, setLog] = useState('')
  return (
    <main className="min-h-screen bg-surface font-rubik px-4 py-10">
      <div className="max-w-lg mx-auto bg-white rounded-card border border-hairline p-5">
        <h2 className="text-sm font-extrabold text-brandblue mb-4">Add: True / False / Not Given</h2>
        <CreateChooser
          itemLabel="this exercise"
          lessonHasReading
          onManual={() => setLog('→ open manual editor')}
          onGenerate={(s: CreateSource, v?: string) => setLog(`→ generate from "${s}"${v ? ` · ${v.slice(0, 40)}` : ''}`)}
        />
        {log && <p className="mt-4 text-xs text-ink-muted">Action: {log}</p>}
      </div>
    </main>
  )
}
