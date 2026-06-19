'use client'

// Wave 0 verification harness for PageHeader. Not linked; delete on sign-off.

import { useState } from 'react'
import PageHeader from '@/components/student-ui/PageHeader'
import { Button } from '@/components/student-ui'

export default function HeaderPreview() {
  const [where, setWhere] = useState('builder')
  return (
    <main className="min-h-screen bg-surface font-rubik px-4 py-10">
      <div className="max-w-2xl mx-auto bg-white rounded-card border border-hairline p-5 space-y-6">
        <PageHeader
          crumbs={[
            { label: 'Courses', onClick: () => setWhere('Courses') },
            { label: 'Business English', onClick: () => setWhere('Course') },
            { label: 'Lesson 4 — Negotiations' },
          ]}
          actions={<Button size="sm">Publish</Button>}
        />
        <PageHeader
          crumbs={[
            { label: 'To review', onClick: () => setWhere('Queue') },
            { label: 'Marek N.' },
          ]}
        />
        <p className="text-xs text-ink-muted">last crumb clicked: {where}</p>
      </div>
    </main>
  )
}
