'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eyebrow } from '@/components/student-ui'

// ═══════════════════════════════════════════════════════════════
// /admin/help — admin documentation page (10B redesign)
//
// New beside old: faithful COPY + RESTYLE of app/admin/help/page.tsx.
// The live /admin/help is left 100% untouched. Same content, same
// section ids/anchors (incl. #whats-new, linked from WhatsNewPanel/
// Banner), same role-gating — restyled to the compact 10B kit/tokens.
// Internal /admin/* links repointed to /admin/*. The mockup boxes
// are styled to look like the actual UI — they're illustrative, not
// real screenshots.
// ═══════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started', icon: '🚀' },
  { id: 'sidebar',          label: 'Sidebar navigation', icon: '🧭' },
  { id: 'courses',          label: 'Courses', icon: '📚' },
  { id: 'students',         label: 'Students', icon: '👥' },
  { id: 'lessons',          label: 'Lessons & exercises', icon: '📖' },
  { id: 'tests',            label: 'Tests', icon: '📝' },
  { id: 'attendance',       label: 'Attendance', icon: '✅' },
  { id: 'reports',          label: 'Reports', icon: '📊' },
  { id: 'notes',            label: 'Teacher notes', icon: '🗒️' },
  { id: 'content-bank',     label: 'Content Bank', icon: '🗃️' },
  { id: 'faqs',             label: 'FAQs', icon: '❓' },
  { id: 'whats-new',        label: "What's new", icon: '✨' },
] as const

export default function HelpPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  if (status === 'loading') {
    return <div className="p-8 text-sm text-ink-muted font-rubik">Loading…</div>
  }
  if (!isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[200px_1fr] gap-5">
        {/* TOC */}
        <aside className="md:sticky md:top-4 md:self-start">
          <Eyebrow className="block mb-2">Contents</Eyebrow>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-xs text-ink-body hover:text-brandblue flex items-center gap-1.5 py-0.5"
                >
                  <span>{s.icon}</span> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <div className="space-y-7 pb-10 min-w-0">
          <header>
            <h1 className="text-2xl font-bold text-brandblue">Help &amp; Docs</h1>
            <p className="text-sm text-ink-muted mt-1">
              A guide to every admin feature in the EwL platform — what it does,
              where to find it, and how to get the most out of it.
            </p>
          </header>

          <GettingStartedSection />
          <SidebarSection />
          <CoursesSection />
          <StudentsSection />
          <LessonsSection />
          <TestsSection />
          <AttendanceSection />
          <ReportsSection />
          <NotesSection />
          <ContentBankSection />
          <FaqsSection />
          <WhatsNewSection />

          <footer className="pt-6 border-t border-hairline text-[11px] text-ink-muted">
            Docs current to v1.2.0. Last updated automatically with each release.
          </footer>
        </div>
      </div>
    </div>
  )
}

// ─── Section helpers ───

function Section({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="text-lg font-bold text-brandblue mb-2.5 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      <div className="space-y-3 text-sm text-ink-body leading-relaxed">{children}</div>
    </section>
  )
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-brandblue mt-3 mb-1">{children}</h3>
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sky-wash border border-sky-border rounded-card px-3 py-2 text-xs text-sky-text">
      <span className="font-bold">💡 Tip: </span>{children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sky-wash border border-sky-border rounded-card px-3 py-2 text-xs text-sky-text">
      <span className="font-bold">ℹ️ Note: </span>{children}
    </div>
  )
}

// Mockup container that looks like real EwL UI
function Mockup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-3">
      {title && <Eyebrow className="block mb-2">{title}</Eyebrow>}
      <div className="bg-white rounded-card border border-hairline p-3 text-xs">{children}</div>
    </div>
  )
}

// ─── Sections ───

function GettingStartedSection() {
  return (
    <Section id="getting-started" icon="🚀" title="Getting started">
      <p>
        Welcome to the EwL admin panel. As a teacher or superadmin you have access to a course-level
        view of your students&apos; learning. The sidebar on the left is your main navigation —
        every feature lives one click away.
      </p>
      <Subhead>The 3 most common workflows</Subhead>
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>
          <span className="font-bold">Authoring</span> — open <Link href="/admin/lessons" className="text-sky-text hover:underline">Lessons</Link> to build flashcards + exercises for your students.
        </li>
        <li>
          <span className="font-bold">Class management</span> — mark attendance after each Zoom class and leave per-student notes in the student detail view.
        </li>
        <li>
          <span className="font-bold">Insight</span> — open <Link href="/admin/reports" className="text-sky-text hover:underline">Reports</Link> to see who&apos;s struggling, what they&apos;re struggling with, and how the class is trending overall.
        </li>
      </ol>
      <Tip>
        New to a feature? Each section below has a mockup of what it looks like, so you can recognise it before you click.
      </Tip>
    </Section>
  )
}

function SidebarSection() {
  return (
    <Section id="sidebar" icon="🧭" title="Sidebar navigation">
      <p>
        The sidebar on the left appears on every admin page. On phones it collapses behind a
        hamburger button (☰) in the top-left corner.
      </p>
      <Mockup title="What the sidebar looks like">
        <div className="grid grid-cols-[140px_1fr] gap-2 text-[11px]">
          <div className="bg-white border border-hairline rounded-card p-2 space-y-0.5">
            <div className="font-bold text-brandblue mb-2">✨ EwL Admin</div>
            <div className="px-2 py-1 rounded-full bg-sky text-white font-bold">📚 My Courses</div>
            <div className="px-2 py-1 rounded-full text-ink-body">👥 My Students</div>
            <div className="px-2 py-1 rounded-full text-ink-body">📖 Lessons</div>
            <div className="px-2 py-1 rounded-full text-ink-body">✅ Attendance</div>
            <div className="px-2 py-1 rounded-full text-ink-body">📊 Reports</div>
            <div className="px-2 py-1 rounded-full text-ink-body">🗃️ Content Bank</div>
            <div className="px-2 py-1 rounded-full text-ink-body">❓ Help &amp; Docs</div>
            <div className="border-t border-hairline mt-2 pt-2 text-ink-muted">Laura</div>
            <div className="text-ink-muted">↪ Sign out</div>
          </div>
          <div className="bg-white border border-hairline rounded-card p-3 text-ink-muted italic">
            (page content shows here)
          </div>
        </div>
      </Mockup>
      <Note>
        Superadmins also see a Superadmin item below the divider, styled in amber to distinguish system-level controls from regular admin work.
      </Note>
    </Section>
  )
}

function CoursesSection() {
  return (
    <Section id="courses" icon="📚" title="Courses">
      <p>
        <Link href="/admin/courses" className="text-sky-text hover:underline">My Courses</Link> lists
        every course you teach. Each card shows the course name, level, type, and how many students
        and lessons it has. Click a card to drill into the course detail.
      </p>
      <Mockup title="Courses list">
        <div className="space-y-2">
          {[
            { name: 'A1.1 — Beginner English', students: 12, lessons: 18 },
            { name: 'B1 Conversational', students: 8, lessons: 26 },
          ].map((c) => (
            <div key={c.name} className="flex items-center justify-between bg-sky-wash rounded-card p-2 border border-sky-border">
              <div>
                <p className="font-bold text-[11px] text-ink-body">{c.name}</p>
                <p className="text-[10px] text-ink-muted">English course</p>
              </div>
              <div className="flex gap-3 text-center">
                <div><p className="font-bold text-sky-text">{c.students}</p><p className="text-[9px] text-ink-muted">students</p></div>
                <div><p className="font-bold text-sky-text">{c.lessons}</p><p className="text-[9px] text-ink-muted">lessons</p></div>
              </div>
            </div>
          ))}
        </div>
      </Mockup>
      <Subhead>Inside a course</Subhead>
      <p>The course detail page has three tabs:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="font-bold">Lessons</span> — every lesson assigned to the course, with status (draft / published) and lesson date.</li>
        <li><span className="font-bold">Students</span> — everyone enrolled, with their level + activity.</li>
        <li><span className="font-bold">Info</span> — course name, description, level, type. Editable.</li>
      </ul>
      <Tip>
        Each course has a unique <span className="font-mono bg-surface px-1 rounded">invite code</span> — share it with students so they can self-enroll.
      </Tip>
    </Section>
  )
}

function StudentsSection() {
  return (
    <Section id="students" icon="👥" title="Students">
      <p>
        <Link href="/admin/students" className="text-sky-text hover:underline">My Students</Link> lists
        every student across all your courses. Use the search box to find anyone by name or email.
      </p>
      <Subhead>Student detail page</Subhead>
      <p>Clicking a student opens their profile with several editable sections:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="font-bold">Profile</span> — level, learning goals, company, common issues tags.</li>
        <li><span className="font-bold">Notes</span> — private freeform notes only you (and other teachers + superadmin) can see.</li>
        <li><span className="font-bold">Activity</span> — chronological progress + recent sessions.</li>
        <li><span className="font-bold">Send reminder</span> — emails a custom message to the student.</li>
      </ul>
      <Note>
        Students never see the notes or common-issues tags you add to their profile. Those are teacher-only.
      </Note>
    </Section>
  )
}

function LessonsSection() {
  return (
    <Section id="lessons" icon="📖" title="Lessons &amp; exercises">
      <p>
        <Link href="/admin/lessons" className="text-sky-text hover:underline">Lessons</Link> is where
        you build the content your students see. Each lesson is a mix of flashcards, exercises, and
        content blocks (text, video, writing prompts).
      </p>

      <Subhead>Exercise types</Subhead>
      <p className="text-xs text-ink-muted mb-1">
        Every type has a visual editor — no JSON needed. Most types support instant per-question
        feedback during practice, and most editors have a 🪄 AI assist where it applies.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">Multiple Choice</span> — single answer or &quot;select all that apply&quot;. Instant feedback + optional explanation per question.</li>
        <li><span className="font-bold">Type the Answer</span> — open-text with optional synonym alternatives. Punctuation-tolerant.</li>
        <li><span className="font-bold">Match Halves</span> — drag keywords to definitions, both sides support images.</li>
        <li><span className="font-bold">True or False</span> — statement + optional explanation shown after answering.</li>
        <li><span className="font-bold">Hangman</span> — wilting-flower visual; tap or keyboard input; optional clue.</li>
        <li><span className="font-bold">Group Sort</span> — drag items into category buckets, with optional images.</li>
        <li><span className="font-bold">Dictation</span> — three audio sources: link / upload / 🪄 AI generate (cached).</li>
        <li><span className="font-bold">Error Correction</span> — incorrect/correct/hint per sentence, live diff preview while authoring, 🪄 Auto-correct button, partial credit per fixed error.</li>
        <li><span className="font-bold">Rank Order</span> — criterion + ordered items, drag to reorder, 👁 preview shuffle.</li>
        <li><span className="font-bold">Text Sequencing</span> — LingQ-style paragraph reordering, 📋 Paste a passage to auto-split.</li>
        <li><span className="font-bold">Unjumble</span> — letters of a word or words of a sentence; tap or drag.</li>
        <li><span className="font-bold">Cloze Listening</span> — gap-fill with audio (same 3-source picker as Dictation).</li>
        <li><span className="font-bold">Odd One Out</span> — pick the item that doesn&apos;t fit + optional explanation.</li>
      </ul>
      <p className="text-[11px] text-ink-muted mt-1">
        Removed in v1.1.3: Fill in the Blank, Transform, Complete the Sentence (overlapped with
        the above). Existing exercises of those types keep working.
      </p>

      <Subhead>Tagging exercises</Subhead>
      <p>Every exercise can be tagged with:</p>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">Skills</span> — multi-select: vocabulary, grammar, listening, reading, writing, speaking, pronunciation. Drives the per-skill breakdown in reports.</li>
        <li><span className="font-bold">CEFR level</span> — A1 through C2. Drives the per-level breakdown in reports.</li>
        <li><span className="font-bold">Test type</span> — Practice (default), Review, Mid-course, or End-of-course. See the <a href="#tests" className="text-sky-text hover:underline">Tests</a> section.</li>
      </ul>

      <Mockup title="Exercise card in the editor">
        <div className="space-y-1.5">
          <p className="font-bold text-brandblue text-[11px]">Past Simple — verb forms</p>
          <p className="text-[10px] text-ink-muted">10 questions · Multiple Choice</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-[9px] bg-sky text-white px-1.5 py-0.5 rounded-full font-bold">Grammar</span>
            <span className="text-[9px] bg-sky text-white px-1.5 py-0.5 rounded-full font-bold">Vocabulary</span>
            <span className="text-[9px] bg-surface text-ink-muted px-1.5 py-0.5 rounded-full font-bold">B1</span>
          </div>
        </div>
      </Mockup>

      <Subhead>Media content blocks (Audio / Video / Reading)</Subhead>
      <p className="text-xs">
        Add a media block from <span className="font-mono">+ Add Content Block</span>. All three
        support a list of <span className="font-bold">follow-up exercises</span> for comprehension —
        attach any mix of <span className="font-bold">Multiple Choice</span>,{' '}
        <span className="font-bold">True/False</span>, <span className="font-bold">Type the Answer</span>,{' '}
        <span className="font-bold">Group Sort</span>, <span className="font-bold">Rank Order</span>, or{' '}
        <span className="font-bold">Unjumble</span>. Drag the ☰ handles to reorder.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs mt-1">
        <li><span className="font-bold">🎧 Audio</span> — paste a URL (Google Drive share links auto-converted) or upload an MP3/WAV/M4A/OGG file (max 10 MB).</li>
        <li><span className="font-bold">🎬 Video</span> — paste a YouTube URL.</li>
        <li><span className="font-bold">📰 Reading</span> — paste article text + optional source attribution.</li>
      </ul>

      <Subhead>AI generation</Subhead>
      <p>The flashcard editor has a &quot;Generate with AI&quot; button — paste your class summary and Claude drafts a set of flashcards. The exercise editor offers AI generation as its own path via <span className="font-mono">+ Add Exercise → Generate with AI</span> (paste text or upload a screenshot of a textbook page).</p>
    </Section>
  )
}

function TestsSection() {
  return (
    <Section id="tests" icon="📝" title="Tests">
      <p>
        Any exercise can be tagged as a test (Review, Mid-course, or End-of-course). Tests behave
        differently from regular practice:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="font-bold">Strict single-attempt</span> — once a student opens a test, the attempt is locked. They can&apos;t open it twice, even if they close the tab without submitting.</li>
        <li><span className="font-bold">First-attempt scoring</span> — the report shows their FIRST score as the &quot;real grade&quot;. Latest score appears alongside for context.</li>
        <li><span className="font-bold">Read-only review</span> — when they re-visit a locked test, they see a per-question right/wrong checklist with the correct answers.</li>
        <li><span className="font-bold">Teacher reset</span> — in reports, click the <span className="font-mono">↺ Reset</span> button next to a test to delete the attempt and let the student retake.</li>
      </ul>
      <Mockup title="Student sees this when a test is already submitted">
        <div className="text-center">
          <div className="text-2xl mb-1">🌟</div>
          <p className="font-bold text-brandblue">Test completed</p>
          <p className="text-[10px] text-ink-muted mt-0.5">You scored 8/10 (80%) · 14 May 2026</p>
          <p className="text-[9px] text-ink-muted mt-1">Tests can only be taken once. Contact your teacher for a retry.</p>
        </div>
      </Mockup>
      <Tip>
        If a student says &quot;I had network issues, can I retry?&quot; — open <Link href="/admin/reports" className="text-sky-text hover:underline">Reports</Link>, find their detail view, scroll to Tests, click ↺ Reset on the right test.
      </Tip>
    </Section>
  )
}

function AttendanceSection() {
  return (
    <Section id="attendance" icon="✅" title="Attendance">
      <p>
        Attendance now lives on each <Link href="/admin/courses" className="text-sky-text hover:underline">course page</Link>:
        record who showed up to each dated class session, right beside the course info.
      </p>
      <Subhead>Marking attendance</Subhead>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Open the course — the Attendance card sits in the right rail.</li>
        <li>On a class day, hit <span className="font-mono">Mark attendance</span> (or <span className="font-mono">+ New class</span> any other day).</li>
        <li>Everyone starts Present — tap the exceptions (Late / Absent / Excused).</li>
        <li>Add an optional per-student note and what you covered.</li>
        <li>Hit <span className="font-mono">Save class</span>.</li>
      </ol>
      <Mockup title="Attendance roster">
        <div className="space-y-1.5">
          {[
            { name: 'Anna Pérez', status: '✓ Present', color: 'bg-correct-bg text-correct-fg border-correct-border' },
            { name: 'Boris Volkov', status: '✕ Absent', color: 'bg-incorrect-bg text-incorrect-fg border-incorrect-border' },
            { name: 'Carla Rossi', status: '🕐 Late', color: 'bg-sky-wash text-sky-text border-sky-border' },
          ].map((s) => (
            <div key={s.name} className="flex items-center justify-between border border-hairline rounded-card px-2 py-1.5">
              <p className="text-[11px] text-ink-body">{s.name}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${s.color} font-bold`}>{s.status}</span>
            </div>
          ))}
        </div>
      </Mockup>
      <Subhead>Statuses</Subhead>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">✓ Present</span> — counted as attended</li>
        <li><span className="font-bold">✕ Absent</span> — counted as missed</li>
        <li><span className="font-bold">🕐 Late</span> — counted as attended (joined late but did join)</li>
        <li><span className="font-bold">📝 Excused</span> — counted as missed but with the &quot;valid reason&quot; nuance</li>
      </ul>
      <p>
        Attendance % shown in <Link href="/admin/reports" className="text-sky-text hover:underline">Reports</Link> = (present + late) ÷ marked sessions.
      </p>
      <Tip>
        Use the &quot;Mark all present&quot; button to flip everyone to present in one click, then only toggle the few who weren&apos;t there. Saves time.
      </Tip>
    </Section>
  )
}

function ReportsSection() {
  return (
    <Section id="reports" icon="📊" title="Reports">
      <p>
        <Link href="/admin/reports" className="text-sky-text hover:underline">Reports</Link> is the
        nerve centre of the admin panel. Two top-level views:
      </p>
      <Subhead>1. Course overview</Subhead>
      <p>One row per student in the selected course. Click a row to drill into that student.</p>
      <Mockup title="Overview table">
        <table className="w-full text-[10px]">
          <thead className="bg-sky-wash">
            <tr className="text-ink-muted uppercase font-bold">
              <th className="py-1 px-2 text-left">Student</th>
              <th className="py-1 px-2 text-left">Completion</th>
              <th className="py-1 px-2 text-left">Attendance</th>
              <th className="py-1 px-2 text-left">Avg Latest</th>
              <th className="py-1 px-2 text-left">Avg Best</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-hairline"><td className="py-1.5 px-2 font-bold">Anna</td><td className="py-1.5 px-2">85% (17/20)</td><td className="py-1.5 px-2">92%</td><td className="py-1.5 px-2">78%</td><td className="py-1.5 px-2">85%</td></tr>
            <tr className="border-t border-hairline"><td className="py-1.5 px-2 font-bold">Boris</td><td className="py-1.5 px-2">40% (8/20)</td><td className="py-1.5 px-2">60%</td><td className="py-1.5 px-2">45%</td><td className="py-1.5 px-2">62%</td></tr>
          </tbody>
        </table>
      </Mockup>

      <Subhead>2. Heatmap view</Subhead>
      <p>Same data as a grid: rows = students, columns = exercises, cells colour-coded by latest score.</p>
      <Mockup title="Heatmap legend">
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-incorrect-bg" /> &lt;50 struggling</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-sky-wash" /> 50–69 so-so</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-correct-bg" /> 70–89 good</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-correct-bg" /> 90+ excellent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-surface" /> not attempted</span>
        </div>
      </Mockup>
      <Tip>
        A vertical red stripe means the whole class struggled on one exercise — worth revisiting in your next session. A horizontal red row means one student is drowning across the board.
      </Tip>

      <Subhead>Student detail</Subhead>
      <p>Click any row or cell to open a single student&apos;s detail view. Sections:</p>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li>
          <span className="font-bold">✨ AI summary</span> — 2-3 sentence narrative generated by Claude using the student&apos;s actual numbers. Hit ↻ Regenerate for a fresh take after new data.
        </li>
        <li>
          <span className="font-bold">Summary cards</span> — Completion %, Avg Latest, Avg Best, Attendance %, Streak (🔥 consecutive days), Total Attempts.
        </li>
        <li><span className="font-bold">Score trend</span> — chart of every attempt over time, so you see improvement or decline at a glance.</li>
        <li><span className="font-bold">Skill breakdown + CEFR performance</span> — horizontal bars showing how the student performs per skill (vocab / grammar / listening etc) and per CEFR level.</li>
        <li><span className="font-bold">Tests</span> — one row per tagged test with first-attempt + latest scores, plus a ↺ Reset button for retakes.</li>
        <li><span className="font-bold">Teacher notes</span> — see <a href="#notes" className="text-sky-text hover:underline">Teacher Notes</a> below.</li>
        <li><span className="font-bold">Attendance history</span> — per-lesson list with status and any notes.</li>
        <li><span className="font-bold">Writing submissions</span> — chronological list of every writing block they submitted, expandable to see the full text.</li>
        <li><span className="font-bold">Per-exercise breakdown</span> — every exercise with attempt count, latest %, best %, and last-attempt date.</li>
      </ul>

      <Subhead>Time range filter</Subhead>
      <p>The dropdown at the top filters by Last 7 / 30 / 90 days, or All time. Defaults to last 30.</p>

      <Subhead>Export as PDF</Subhead>
      <p>Click <span className="font-mono">Export as PDF</span> (top right) to print the current view to PDF. The sidebar and controls auto-hide.</p>
    </Section>
  )
}

function NotesSection() {
  return (
    <Section id="notes" icon="🗒️" title="Teacher notes">
      <p>
        Each student has a dated log of notes you can add — visible in the student detail view in
        Reports. Notes are private: only teachers on that course (plus superadmin) see them.
        Students never see.
      </p>
      <Subhead>Tags</Subhead>
      <p>Each note gets a tag chosen from a fixed set:</p>
      <div className="flex flex-wrap gap-1.5">
        {[
          { l: 'General', c: 'bg-surface text-ink-body' },
          { l: 'Homework', c: 'bg-sky-wash text-sky-text' },
          { l: 'Behaviour', c: 'bg-sky-wash text-sky-text' },
          { l: 'Parent contact', c: 'bg-correct-bg text-correct-fg' },
          { l: 'Academic concern', c: 'bg-incorrect-bg text-incorrect-fg' },
        ].map((t) => (
          <span key={t.l} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.c}`}>{t.l}</span>
        ))}
      </div>
      <Mockup title="Notes log">
        <div className="space-y-2">
          <div className="border border-hairline rounded-card p-2">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-incorrect-bg text-incorrect-fg">Academic concern</span>
              <span className="text-[9px] text-ink-muted">14 May 2026 · laura@ewl.com</span>
            </div>
            <p className="text-[11px] text-ink-body">Anna struggling with past simple — schedule a one-on-one next week.</p>
          </div>
          <div className="border border-hairline rounded-card p-2">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-correct-bg text-correct-fg">Parent contact</span>
              <span className="text-[9px] text-ink-muted">10 May 2026 · laura@ewl.com</span>
            </div>
            <p className="text-[11px] text-ink-body">Mother emailed about progress. Replied with mid-course test plan.</p>
          </div>
        </div>
      </Mockup>
    </Section>
  )
}

function ContentBankSection() {
  return (
    <Section id="content-bank" icon="🗃️" title="Content Bank">
      <p>
        <Link href="/admin/content-bank" className="text-sky-text hover:underline">Content Bank</Link> is
        a shared library of reusable lesson templates. Save a lesson once, drop it into multiple
        courses. Useful when you teach the same grammar topic across several courses.
      </p>

      <Subhead>Browsing</Subhead>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">🔍 Title search</span> — type-ahead match on lesson titles.</li>
        <li><span className="font-bold">Author dropdown</span> — show only templates by a specific trainer.</li>
        <li><span className="font-bold">Folders</span> on the left, plus Level / Category / Sort (most recent or Author A→Z) controls.</li>
        <li>Each card shows <span className="font-mono">Created by … · Added {`<date>`}</span>. Click the author name to filter to that trainer.</li>
      </ul>

      <Subhead>Bulk import to a course</Subhead>
      <p className="text-xs">
        From a course page click <span className="font-mono">+ Create Lesson → From Content Bank</span>{' '}
        to open a picker. Choose a folder, search by title, multi-select lessons, then commit with
        one of three actions:
      </p>
      <ul className="list-disc pl-5 space-y-1 text-xs mt-1">
        <li><span className="font-bold">Publish now</span> — visible to students immediately.</li>
        <li><span className="font-bold">Save as draft</span> — hidden until you publish.</li>
        <li><span className="font-bold">Schedule…</span> — pick a date + time + timezone. Lessons stay draft until the chosen moment, then auto-publish (within ~15 min of the time you set).</li>
      </ul>
      <Tip>
        A red <span className="font-bold">⚠ already in this course</span> warning appears next to
        any selected lesson whose title already exists in the course, so you can decide whether to
        proceed or remove it.
      </Tip>

      <Subhead>Adding to the bank</Subhead>
      <p className="text-xs">
        In any lesson editor, toggle <span className="font-mono">Share as Template</span> and pick a
        Level + Category. The lesson appears in the Content Bank under your name.
      </p>
    </Section>
  )
}

function FaqsSection() {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: 'Why can\'t my student retake a test?',
      a: <>Tests use strict single-start: opening the test once locks the attempt. To let them retake, open Reports → their detail page → Tests section → click <span className="font-mono">↺ Reset</span> next to that test.</>,
    },
    {
      q: 'Where do I add CEFR levels to exercises?',
      a: <>In the exercise editor (inside any lesson). Each exercise has a <span className="font-bold">CEFR level</span> dropdown and a <span className="font-bold">Skills</span> multi-select right below the Points configuration.</>,
    },
    {
      q: 'A student is missing from My Students',
      a: <>Likely not enrolled in any of your courses. Check the course detail page → Students tab — if they&apos;re not there, share the course&apos;s invite code with them so they can self-enroll.</>,
    },
    {
      q: 'The AI summary on a student says something I disagree with',
      a: <>Click <span className="font-mono">↻ Regenerate</span> on the summary card — it&apos;ll create a new one. Claude only uses the student&apos;s actual numbers, but it can interpret trends differently each time.</>,
    },
    {
      q: 'Can I delete a lesson or exercise?',
      a: <>Yes, from inside the lesson editor — there&apos;s a delete button on each card. Be careful: this removes it for any student who hasn&apos;t completed it yet. Past completion data stays in the progress log.</>,
    },
    {
      q: 'Where are my writing-submission texts?',
      a: <>Open Reports → student detail → scroll to the &quot;Writing submissions&quot; section. Each submission is expandable to see the full text. (Submissions made before mid-May 2026 may show &quot;No text recorded&quot; — that data was lost before a bug fix.)</>,
    },
  ]
  return (
    <Section id="faqs" icon="❓" title="FAQs">
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={i} className="border-l-2 border-sky-border pl-3">
            <p className="text-sm font-bold text-ink-black">{f.q}</p>
            <p className="text-xs text-ink-muted mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function WhatsNewSection() {
  return (
    <Section id="whats-new" icon="✨" title="What's new">
      <Subhead>Latest — v1.2.0</Subhead>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <span className="font-bold">🎙 Speak to AI — voice in / voice out.</span> The Dialogue
          block now has a real microphone. Students tap to record (or hold for push-to-talk), get
          their speech transcribed by Whisper, edit before sending, then hear AI replies played
          aloud in a warm conversational voice. Per-message 🔊 Listen button for replay.
        </li>
        <li>
          <span className="font-bold">🪞 Live correction panel in dialogue.</span> When a student
          makes a grammar or vocabulary mistake, an amber &quot;Watch out for&quot; box appears below
          the AI reply showing <span className="text-incorrect-fg line-through">what they said</span> →{' '}
          <span className="text-correct-fg">the correction</span> + a 1-sentence why. Easier for
          students to actually internalise corrections than embedded ones.
        </li>
        <li>
          <span className="font-bold">📋 Finish session report (student-side)</span> + view student
          chats (teacher-side). New &quot;Finish session ▸&quot; button on every dialogue. Opens a
          recap modal: target-words used, top 2-3 corrections, encouragement, &quot;for next time&quot;
          suggestion. On the lesson editor, dialogue blocks gain a 📊 View student chats button —
          modal with every student attempt, transcript, corrections list, and a Mark reviewed toggle.
        </li>
        <li>
          <span className="font-bold">🧠 Lemma-aware word detection.</span> Dialogue used to do
          substring matching — &quot;I ran yesterday&quot; didn&apos;t credit target word &quot;run&quot;.
          Now: ~150 common irregular verb forms + doubled-consonant (stopping → stop), Y/I
          (carried → carry), silent-e (filed → file), and multi-word phrase inflection
          (looked after → look after) all credited.
        </li>
        <li>
          <span className="font-bold">📖 AI Reading — rich form.</span> The Reading (Article) block
          gets a brand-new 2-tab Generate-with-AI flow: <em>Use a source</em> (paste a URL, upload
          an image, or paste raw text — AI rewrites at your target level / length / style) or{' '}
          <em>Create from scratch</em> (type, topic, narrator POV, characters, grammar focus, vocab
          + a course-wide vocabulary picker). After it generates: <em>Suggest exercises with AI</em>
          button on the block → pick types → AI drafts comprehension exercises straight from the text.
        </li>
        <li>
          <span className="font-bold">📐 AI Grammar — rich form.</span> Same treatment for Grammar:
          topic, already-known grammar, vocab picker, practice types (MCQ / TF / Type / Error
          Correction multi-select), explanation length, &quot;Include common pitfalls&quot; toggle.
          Examples auto-bold the target structure and get per-line 🔊 Listen buttons (using the new
          cached TTS). Pitfalls render as a red strikethrough → green correct → tip box.
        </li>
        <li>
          <span className="font-bold">📊 CEFR adaptation everywhere.</span> Every AI generation
          surface (flashcards, exercises, all six block types, doc imports) now reads the course&apos;s
          CEFR level and adapts vocabulary + grammar accordingly. &quot;Beginner&quot; → A1 →{' '}
          <em>&quot;A pet animal&quot;</em>; &quot;Advanced&quot; → C1 → more nuanced phrasing.
          Friendly course names like &quot;Beginner&quot; / &quot;Intermediate Low&quot; map to
          CEFR codes automatically — no extra teacher input needed.
        </li>
        <li>
          <span className="font-bold">💰 Cheaper TTS + tiered AI models.</span> Audio playback
          switched from ElevenLabs to OpenAI TTS (~10× cheaper at comparable quality) + every
          unique sentence is cached once in Supabase Storage so repeat plays cost nothing.
          AI generation now tiered: Sonnet 4 stays on creative work (Reading, Grammar,
          dialogue); Haiku 4.5 handles templated work (exercise gen, flashcards, type conversion,
          doc imports) — roughly 60-70% AI bill drop with no quality regression on what teachers
          care about.
        </li>
        <li>
          <span className="font-bold">👁 Per-block publish / unpublish.</span> Every content block
          (incl. flashcards) now has a small eye icon in its header. Click to hide from students
          without deleting the block. New blocks added to a published lesson default to hidden so
          half-built content doesn&apos;t accidentally ship; new blocks in a draft lesson default
          to visible (will go live when the lesson publishes). Existing student progress on a
          now-hidden block is preserved — only visibility changes.
        </li>
        <li>
          <span className="font-bold">✏️ Editable course invite codes.</span> Replace the random
          auto-generated codes with something memorable (e.g. <span className="font-mono">TRAVEL24</span>).
          Both admin Info tab and superadmin invite panel have the field. Case-insensitive
          uniqueness — students typing any case still match. Doesn&apos;t affect anyone already
          enrolled.
        </li>
        <li>
          <span className="font-bold">💬 Telegram lesson notifications.</span> Each course can post
          to a Telegram group when a lesson publishes (or at a scheduled time). Add{' '}
          <span className="font-mono">@English_with_Laura_Bot</span> to the group, paste the chat
          ID into course settings (the bot replies to <span className="font-mono">/chatid</span>),
          done. &quot;Send test message&quot; button verifies the wiring.
        </li>
        <li>
          <span className="font-bold">🤖 AI generation on every content block type.</span> Mistakes,
          Article, Grammar, Dialogue, Writing, Pronunciation all gained Generate-with-AI / Create-Manually
          modals. Each has a sub-type focus dropdown (e.g. Grammar → Tenses / Articles / Prepositions
          / Conditionals / etc.) plus a free-text &quot;Other&quot; for off-list focuses.
        </li>
        <li>
          <span className="font-bold">🎯 Multiple Choice + Rank Order + Type-the-Answer editors
          start small.</span> MCQ used to spawn with 4 empty options; now starts with 2 plus an{' '}
          <em>+ Add answer</em> button (up to 6). Per-row × delete, no pre-selected correct answer
          (forces teacher to pick), save-time validation blocks blank options + missing correct
          answer. Rank Order: floor 3, ceiling 6 items. Type-Answer alternates: max 6.
        </li>
      </ul>

      <Subhead>Earlier — v1.1.3</Subhead>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <span className="font-bold">🎧 New Audio content block</span> — paste a link, upload a file,
          or use a Google Drive share URL. Same place as Video and Reading.
        </li>
        <li>
          <span className="font-bold">📚 Audio / Video / Reading all support 6 follow-up exercise types</span> —
          Multiple Choice, True/False, Type the Answer, Group Sort, Rank Order, Unjumble. Drag to
          reorder. Existing video/reading blocks keep working; they pick up the new powers the next
          time you edit them.
        </li>
        <li>
          <span className="font-bold">📝 Every exercise type now has a visual editor — no more JSON.</span>{' '}
          Hangman, Dictation, Error Correction, Text Sequencing, True/False, Rank Order, and Cloze
          Listening all got proper teacher-friendly editors.
        </li>
        <li>
          <span className="font-bold">💡 Instant feedback during practice</span> — Multiple Choice and
          Fill-blank now show a green/red explanation right after the student answers (instead of waiting
          for the end). Add an optional <span className="font-mono">Explanation</span> per question so
          students see <em>why</em> the correct answer is correct. Tests (with a test_type set) keep
          the original &quot;no feedback until end&quot; behaviour.
        </li>
        <li>
          <span className="font-bold">🎙 Dictation got three audio sources</span> — Link (Google Drive
          auto-converted), Upload, or 🪄 AI generate. AI audio caches once — students don&apos;t
          re-generate on each play.
        </li>
        <li>
          <span className="font-bold">✏️ Error Correction is smarter</span> — live diff preview while
          you author, 🪄 Auto-correct button, partial credit (2 of 3 errors = 2/3, not 0), and false
          positives are surfaced to students (&quot;⚠ already correct&quot;).
        </li>
        <li>
          <span className="font-bold">🌸 Hangman got a friendlier look</span> — wilting flower instead
          of a hanging stick figure (sad face when out, sparkles on win). Keyboard input alongside the
          tap grid.
        </li>
        <li>
          <span className="font-bold">🖼 Better image search for flashcards</span> — Pexels + Pixabay,
          a real thumbnail grid, refine-search box, and an Illustrations tab.
        </li>
        <li>
          <span className="font-bold">📦 Content Bank upgrades</span> — title search, author dropdown,
          author + date shown on every template, and bulk import from a course page (pick multiple
          lessons, publish-now / save-as-draft / schedule).
        </li>
        <li>
          <span className="font-bold">📊 Reports got a Vocabulary section</span> per student (mastery
          stages, per-lesson breakdown). New <span className="font-bold">Export modal</span> — choose
          sections + students and produce a branded PDF or CSV.
        </li>
        <li>
          <span className="font-bold">🔍 Search where it matters</span> — Lesson Manager and the
          Reports overview are now searchable.
        </li>
        <li>
          <span className="font-bold">🧹 Removed from the picker</span> — Fill in the Blank, Transform,
          and Complete the Sentence (they overlapped with Multiple Choice / Type the Answer). Existing
          exercises keep working; just no new ones.
        </li>
      </ul>

      <Subhead>Even earlier — v1.1.x</Subhead>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><span className="font-bold">Persistent sidebar nav</span> on every admin page (with mobile hamburger menu)</li>
        <li><span className="font-bold">Deep routes</span> for /admin/courses and /admin/students</li>
        <li><span className="font-bold">Help &amp; Docs</span> — this page!</li>
        <li><span className="font-bold">Class heatmap</span> on Reports (Table | Heatmap toggle)</li>
        <li><span className="font-bold">AI narrative summary</span> at the top of every student detail report</li>
        <li><span className="font-bold">Test-type tagging</span> — mark exercises as Review / Mid-course / End-of-course tests</li>
        <li><span className="font-bold">Test lock with teacher reset</span> — one-shot tests, with ↺ Reset for retakes</li>
        <li><span className="font-bold">Writing submissions timeline</span> — chronological view + word counts</li>
        <li><span className="font-bold">Skill breakdown + CEFR + streak</span> in student reports</li>
        <li><span className="font-bold">Teacher notes</span> + <span className="font-bold">attendance teacher UI</span></li>
        <li><span className="font-bold">PDF export</span> on Reports</li>
        <li><span className="font-bold">Group Sort editor</span> rebuilt Wordwall-style (with images)</li>
        <li><span className="font-bold">Multi-correct multiple choice</span> + <span className="font-bold">type-answer synonyms</span></li>
        <li><span className="font-bold">Quietly killed:</span> the student-activity email spam to your inbox</li>
      </ul>
    </Section>
  )
}
