'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// /admin/help — admin documentation page
//
// Single long-form page documenting every admin/superadmin feature
// shipped through v1.1.x. The mockup boxes are styled to look like
// the actual UI (same colours and patterns) — they're illustrative,
// not real screenshots.
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

  if (status === 'loading') return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (!isAdmin) return <div className="p-8 text-sm text-red-500">Access denied — admin or teacher only.</div>

  return (
    <div className="px-4 py-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[200px_1fr] gap-6">
        {/* TOC */}
        <aside className="md:sticky md:top-4 md:self-start">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Contents</p>
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-xs text-[#46464b] hover:text-[#416ebe] flex items-center gap-1.5"
                >
                  <span>{s.icon}</span> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <div className="space-y-10 pb-12 min-w-0">
          <header>
            <h1 className="text-2xl font-bold text-[#416ebe]">Help &amp; Docs</h1>
            <p className="text-sm text-gray-500 mt-1">
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

          <footer className="pt-8 border-t border-[#e6f0fa] text-[11px] text-gray-400">
            Docs current to v1.1.x. Last updated automatically with each release.
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
      <h2 className="text-lg font-bold text-[#416ebe] mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      <div className="space-y-4 text-sm text-[#46464b] leading-relaxed">{children}</div>
    </section>
  )
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-[#416ebe] mt-4 mb-1">{children}</h3>
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-300 px-3 py-2 text-xs text-amber-800 rounded-r">
      <span className="font-bold">💡 Tip: </span>{children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#e6f0fa] border-l-4 border-[#416ebe] px-3 py-2 text-xs text-[#416ebe] rounded-r">
      <span className="font-bold">ℹ️ Note: </span>{children}
    </div>
  )
}

// Mockup container that looks like real EwL UI
function Mockup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#f7fafd] rounded-xl border border-[#cddcf0] p-3">
      {title && <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{title}</p>}
      <div className="bg-white rounded-lg border border-[#e6f0fa] p-3 text-xs">{children}</div>
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
          <span className="font-bold">Authoring</span> — open <Link href="/admin/lessons" className="text-[#416ebe] hover:underline">Lessons</Link> to build flashcards + exercises for your students.
        </li>
        <li>
          <span className="font-bold">Class management</span> — mark attendance after each Zoom class and leave per-student notes in the student detail view.
        </li>
        <li>
          <span className="font-bold">Insight</span> — open <Link href="/admin/reports" className="text-[#416ebe] hover:underline">Reports</Link> to see who&apos;s struggling, what they&apos;re struggling with, and how the class is trending overall.
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
          <div className="bg-white border border-[#e6f0fa] rounded-md p-2 space-y-0.5">
            <div className="font-bold text-[#416ebe] mb-2">✨ EwL Admin</div>
            <div className="px-2 py-1 rounded bg-[#416ebe] text-white font-bold">📚 My Courses</div>
            <div className="px-2 py-1 rounded text-[#46464b]">👥 My Students</div>
            <div className="px-2 py-1 rounded text-[#46464b]">📖 Lessons</div>
            <div className="px-2 py-1 rounded text-[#46464b]">✅ Attendance</div>
            <div className="px-2 py-1 rounded text-[#46464b]">📊 Reports</div>
            <div className="px-2 py-1 rounded text-[#46464b]">🗃️ Content Bank</div>
            <div className="px-2 py-1 rounded text-[#46464b]">❓ Help &amp; Docs</div>
            <div className="border-t border-[#e6f0fa] mt-2 pt-2 text-gray-400">Laura</div>
            <div className="text-gray-400">↪ Sign out</div>
          </div>
          <div className="bg-white border border-[#e6f0fa] rounded-md p-3 text-gray-400 italic">
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
        <Link href="/admin/courses" className="text-[#416ebe] hover:underline">My Courses</Link> lists
        every course you teach. Each card shows the course name, level, type, and how many students
        and lessons it has. Click a card to drill into the course detail.
      </p>
      <Mockup title="Courses list">
        <div className="space-y-2">
          {[
            { name: 'A1.1 — Beginner English', students: 12, lessons: 18 },
            { name: 'B1 Conversational', students: 8, lessons: 26 },
          ].map((c) => (
            <div key={c.name} className="flex items-center justify-between bg-[#f7fafd] rounded-md p-2 border border-[#e6f0fa]">
              <div>
                <p className="font-bold text-[11px] text-[#46464b]">{c.name}</p>
                <p className="text-[10px] text-gray-400">English course</p>
              </div>
              <div className="flex gap-3 text-center">
                <div><p className="font-bold text-[#416ebe]">{c.students}</p><p className="text-[9px] text-gray-400">students</p></div>
                <div><p className="font-bold text-[#416ebe]">{c.lessons}</p><p className="text-[9px] text-gray-400">lessons</p></div>
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
        Each course has a unique <span className="font-mono bg-gray-100 px-1 rounded">invite code</span> — share it with students so they can self-enroll.
      </Tip>
    </Section>
  )
}

function StudentsSection() {
  return (
    <Section id="students" icon="👥" title="Students">
      <p>
        <Link href="/admin/students" className="text-[#416ebe] hover:underline">My Students</Link> lists
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
        <Link href="/admin/lessons" className="text-[#416ebe] hover:underline">Lessons</Link> is where
        you build the content your students see. Each lesson is a mix of flashcards, exercises, and
        content blocks (text, video, writing prompts).
      </p>

      <Subhead>Exercise types</Subhead>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">Multiple Choice</span> — single answer or &quot;select all that apply&quot; (multi-correct mode)</li>
        <li><span className="font-bold">Type the Answer</span> — open-text with optional synonym alternatives</li>
        <li><span className="font-bold">Group Sort</span> — drag items into category buckets, with optional images</li>
        <li><span className="font-bold">Complete the Sentence</span> — fill in gaps with a word bank</li>
        <li><span className="font-bold">True or False</span>, <span className="font-bold">Hangman</span>, <span className="font-bold">Error Correction</span>, <span className="font-bold">Rank Order</span>, <span className="font-bold">Text Sequencing</span>, <span className="font-bold">Unjumble</span>, <span className="font-bold">Cloze Listening</span>, <span className="font-bold">Match Halves</span>, <span className="font-bold">Odd One Out</span>, <span className="font-bold">Dictation</span></li>
      </ul>

      <Subhead>Tagging exercises</Subhead>
      <p>Every exercise can be tagged with:</p>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li><span className="font-bold">Skills</span> — multi-select: vocabulary, grammar, listening, reading, writing, speaking, pronunciation. Drives the per-skill breakdown in reports.</li>
        <li><span className="font-bold">CEFR level</span> — A1 through C2. Drives the per-level breakdown in reports.</li>
        <li><span className="font-bold">Test type</span> — Practice (default), Review, Mid-course, or End-of-course. See the <a href="#tests" className="text-[#416ebe] hover:underline">Tests</a> section.</li>
      </ul>

      <Mockup title="Exercise card in the editor">
        <div className="space-y-1.5">
          <p className="font-bold text-[#416ebe] text-[11px]">Past Simple — verb forms</p>
          <p className="text-[10px] text-gray-400">10 questions · Multiple Choice</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-[9px] bg-[#416ebe] text-white px-1.5 py-0.5 rounded-full font-bold">Grammar</span>
            <span className="text-[9px] bg-[#416ebe] text-white px-1.5 py-0.5 rounded-full font-bold">Vocabulary</span>
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">B1</span>
          </div>
        </div>
      </Mockup>

      <Subhead>AI generation</Subhead>
      <p>The flashcard editor has a &quot;Generate with AI&quot; button — paste your class summary and Claude drafts a set of flashcards. You can edit any of them before saving.</p>
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
          <p className="font-bold text-[#416ebe]">Test completed</p>
          <p className="text-[10px] text-gray-400 mt-0.5">You scored 8/10 (80%) · 14 May 2026</p>
          <p className="text-[9px] text-gray-400 mt-1">Tests can only be taken once. Contact your teacher for a retry.</p>
        </div>
      </Mockup>
      <Tip>
        If a student says &quot;I had network issues, can I retry?&quot; — open <Link href="/admin/reports" className="text-[#416ebe] hover:underline">Reports</Link>, find their detail view, scroll to Tests, click ↺ Reset on the right test.
      </Tip>
    </Section>
  )
}

function AttendanceSection() {
  return (
    <Section id="attendance" icon="✅" title="Attendance">
      <p>
        <Link href="/admin/attendance" className="text-[#416ebe] hover:underline">Attendance</Link> lets
        you record who showed up to each class session.
      </p>
      <Subhead>Marking attendance</Subhead>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Pick a course from the dropdown.</li>
        <li>Pick a lesson — each lesson&apos;s date is shown for orientation.</li>
        <li>For each student, click one of the four status toggles.</li>
        <li>Add an optional per-record note (e.g. &quot;joined 10 min late&quot;).</li>
        <li>Hit <span className="font-mono">Save attendance</span>.</li>
      </ol>
      <Mockup title="Attendance roster">
        <div className="space-y-1.5">
          {[
            { name: 'Anna Pérez', status: '✓ Present', color: 'bg-green-50 text-green-600 border-green-200' },
            { name: 'Boris Volkov', status: '✕ Absent', color: 'bg-red-50 text-red-500 border-red-200' },
            { name: 'Carla Rossi', status: '🕐 Late', color: 'bg-amber-50 text-amber-600 border-amber-200' },
          ].map((s) => (
            <div key={s.name} className="flex items-center justify-between border border-[#e6f0fa] rounded px-2 py-1.5">
              <p className="text-[11px] text-[#46464b]">{s.name}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${s.color} font-bold`}>{s.status}</span>
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
        Attendance % shown in <Link href="/admin/reports" className="text-[#416ebe] hover:underline">Reports</Link> = (present + late) ÷ marked sessions.
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
        <Link href="/admin/reports" className="text-[#416ebe] hover:underline">Reports</Link> is the
        nerve centre of the admin panel. Two top-level views:
      </p>
      <Subhead>1. Course overview</Subhead>
      <p>One row per student in the selected course. Click a row to drill into that student.</p>
      <Mockup title="Overview table">
        <table className="w-full text-[10px]">
          <thead className="bg-[#f7fafd]">
            <tr className="text-gray-400 uppercase font-bold">
              <th className="py-1 px-2 text-left">Student</th>
              <th className="py-1 px-2 text-left">Completion</th>
              <th className="py-1 px-2 text-left">Attendance</th>
              <th className="py-1 px-2 text-left">Avg Latest</th>
              <th className="py-1 px-2 text-left">Avg Best</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#e6f0fa]"><td className="py-1.5 px-2 font-bold">Anna</td><td className="py-1.5 px-2">85% (17/20)</td><td className="py-1.5 px-2">92%</td><td className="py-1.5 px-2">78%</td><td className="py-1.5 px-2">85%</td></tr>
            <tr className="border-t border-[#e6f0fa]"><td className="py-1.5 px-2 font-bold">Boris</td><td className="py-1.5 px-2">40% (8/20)</td><td className="py-1.5 px-2">60%</td><td className="py-1.5 px-2">45%</td><td className="py-1.5 px-2">62%</td></tr>
          </tbody>
        </table>
      </Mockup>

      <Subhead>2. Heatmap view</Subhead>
      <p>Same data as a grid: rows = students, columns = exercises, cells colour-coded by latest score.</p>
      <Mockup title="Heatmap legend">
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100" /> &lt;50 struggling</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100" /> 50–69 so-so</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-lime-100" /> 70–89 good</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-100" /> 90+ excellent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100" /> not attempted</span>
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
        <li><span className="font-bold">Teacher notes</span> — see <a href="#notes" className="text-[#416ebe] hover:underline">Teacher Notes</a> below.</li>
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
          { l: 'General', c: 'bg-gray-100 text-gray-600' },
          { l: 'Homework', c: 'bg-blue-100 text-blue-600' },
          { l: 'Behaviour', c: 'bg-purple-100 text-purple-600' },
          { l: 'Parent contact', c: 'bg-green-100 text-green-600' },
          { l: 'Academic concern', c: 'bg-amber-100 text-amber-600' },
        ].map((t) => (
          <span key={t.l} className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.c}`}>{t.l}</span>
        ))}
      </div>
      <Mockup title="Notes log">
        <div className="space-y-2">
          <div className="border border-[#e6f0fa] rounded p-2">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">Academic concern</span>
              <span className="text-[9px] text-gray-400">14 May 2026 · laura@ewl.com</span>
            </div>
            <p className="text-[11px] text-[#46464b]">Anna struggling with past simple — schedule a one-on-one next week.</p>
          </div>
          <div className="border border-[#e6f0fa] rounded p-2">
            <div className="flex gap-2 items-center mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-600">Parent contact</span>
              <span className="text-[9px] text-gray-400">10 May 2026 · laura@ewl.com</span>
            </div>
            <p className="text-[11px] text-[#46464b]">Mother emailed about progress. Replied with mid-course test plan.</p>
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
        <Link href="/admin/content-bank" className="text-[#416ebe] hover:underline">Content Bank</Link> is
        a library of reusable exercise content. Save a question set once, drop it into multiple
        lessons. Useful when you teach the same grammar topic across several courses.
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
          <div key={i} className="border-l-2 border-[#cddcf0] pl-3">
            <p className="text-sm font-bold text-[#46464b]">{f.q}</p>
            <p className="text-xs text-gray-500 mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function WhatsNewSection() {
  return (
    <Section id="whats-new" icon="✨" title="What's new in v1.1.x">
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
