'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import FlipMode from '@/components/FlipMode'
import SelfAssessMode from '@/components/SelfAssessMode'
import QuizMode from '@/components/QuizMode'
import ExerciseRunner from '@/components/ExerciseRunner'
import TrueOrFalseRunner from '@/components/TrueOrFalseRunner'
import HangmanRunner from '@/components/HangmanRunner'
import TypeAnswerRunner from '@/components/TypeAnswerRunner'
import CompleteSentenceRunner from '@/components/CompleteSentenceRunner'
import GroupSortRunner from '@/components/GroupSortRunner'
import DictationRunner from '@/components/DictationRunner'
import ErrorCorrectionRunner from '@/components/ErrorCorrectionRunner'
import RankOrderRunner from '@/components/RankOrderRunner'
import TextSequencingRunner from '@/components/TextSequencingRunner'
import AnagramRunner from '@/components/AnagramRunner'
import ClozeListeningRunner from '@/components/ClozeListeningRunner'
import MatchHalvesRunner from '@/components/MatchHalvesRunner'
import AudioButton from '@/components/AudioButton'

// ── Interfaces ──

interface Flashcard {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes?: string
  order_index?: number
}

interface LessonExercise {
  id: string
  title: string
  subtitle: string
  icon: string
  instructions: string
  exercise_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any  // Shape varies by exercise_type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupData?: any  // For group_sort type
  order_index: number
  points_per_answer?: number
  completion_bonus?: number
  is_mandatory?: boolean
}

interface ExerciseQuestion {
  id: number
  prompt: string
  options: string[]
  correctIndex: number
  hint?: string
}

interface Lesson {
  id: string
  title: string
  lesson_date: string
  summary: string
  lesson_type?: string
}

interface MistakeItem {
  original: string
  correction: string
  explanation: string
  practice?: { prompt: string; options: string[]; correctIndex: number }[]
}

interface MistakesContent {
  mistakes: MistakeItem[]
}

interface VideoContent {
  youtube_url: string
  questions: { id: number; prompt: string; options: string[]; correctIndex: number }[]
}

interface ArticleContent {
  text: string
  source?: string
  questions: { id: number; prompt: string; options: string[]; correctIndex: number }[]
}

interface DialogueContent {
  scenario: string
  target_words: string[]
  starter_message: string
}

interface GrammarContent {
  explanation: string
  examples: string[]
  exercises: { id: number; prompt: string; options: string[]; correctIndex: number }[]
}

interface WritingContent {
  prompt: string
  guidelines: string
  word_limit: number
}

interface PronunciationWord {
  word: string
  phonetic: string
  tips: string
}

interface PronunciationContent {
  words: PronunciationWord[]
}

interface ContentBlock {
  id: string
  block_type: 'mistakes' | 'video' | 'article' | 'dialogue' | 'grammar' | 'writing' | 'pronunciation'
  title: string
  content: MistakesContent | VideoContent | ArticleContent | DialogueContent | GrammarContent | WritingContent | PronunciationContent
  order_index: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type View =
  | 'overview'
  | 'flashcards'
  | 'exercises'
  | 'exercise-runner'
  | 'block'

type FlashcardMode = 'flip' | 'self-assess' | 'quiz'

// ── Block metadata ──

const BLOCK_META: Record<string, { icon: string; label: string }> = {
  mistakes: { icon: '❌', label: 'Common Mistakes' },
  video: { icon: '🎬', label: 'Watch & Learn' },
  article: { icon: '📄', label: 'Read & Understand' },
  dialogue: { icon: '💬', label: 'Conversation Practice' },
  grammar: { icon: '📐', label: 'Grammar Focus' },
  writing: { icon: '✍️', label: 'Writing Task' },
  pronunciation: { icon: '🔊', label: 'Pronunciation Practice' },
}

// ── Inline Quiz Component ──

function InlineQuiz({
  questions,
  onComplete,
}: {
  questions: { id?: number; prompt: string; options: string[]; correctIndex: number }[]
  onComplete?: (score: number, total: number) => void
}) {
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [completeFired, setCompleteFired] = useState(false)

  const score = questions.reduce(
    (acc, q, i) => acc + (selected[i] === q.correctIndex ? 1 : 0),
    0
  )
  const allAnswered = Object.keys(selected).length === questions.length

  const handleCheck = () => {
    setShowResults(true)
    if (!completeFired && onComplete) {
      const s = questions.reduce((acc, q, i) => acc + (selected[i] === q.correctIndex ? 1 : 0), 0)
      onComplete(s, questions.length)
      setCompleteFired(true)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {questions.map((q, qi) => {
        const userAnswer = selected[qi]
        const answered = userAnswer !== undefined
        const isCorrect = userAnswer === q.correctIndex

        return (
          <div key={qi} className="bg-white rounded-xl border-2 border-[#cddcf0] p-4">
            <p className="text-sm font-medium text-[#46464b] mb-3">{q.prompt}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                let btnClass =
                  'w-full text-left border-2 rounded-xl py-2.5 px-4 text-sm transition-all '
                if (showResults && answered) {
                  if (oi === q.correctIndex) {
                    btnClass += 'border-green-400 bg-green-50 text-green-700 font-bold'
                  } else if (oi === userAnswer && !isCorrect) {
                    btnClass += 'border-red-300 bg-red-50 text-red-500 line-through'
                  } else {
                    btnClass += 'border-gray-200 text-gray-400'
                  }
                } else if (userAnswer === oi) {
                  btnClass += 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe] font-bold'
                } else {
                  btnClass += 'border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] bg-white'
                }

                return (
                  <button
                    key={oi}
                    onClick={() => {
                      if (showResults) return
                      setSelected({ ...selected, [qi]: oi })
                    }}
                    className={btnClass}
                  >
                    <span className="text-gray-400 mr-2">
                      {String.fromCharCode(97 + oi)})
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {!showResults && (
        <button
          onClick={handleCheck}
          disabled={!allAnswered}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check answers
        </button>
      )}

      {showResults && (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">
            {score === questions.length ? '🌟' : score >= questions.length * 0.6 ? '👍' : '💪'}
          </div>
          <p className="text-sm font-bold text-[#416ebe]">
            {score}/{questions.length} correct
          </p>
          <button
            onClick={() => {
              setSelected({})
              setShowResults(false)
            }}
            className="mt-3 text-xs text-[#416ebe] hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// ── Dialogue Chat Component ──

function DialogueChat({
  block,
  studentEmail,
  studentName,
  onAllWordsUsed,
}: {
  block: ContentBlock
  studentEmail: string
  studentName: string
  onAllWordsUsed?: () => void
}) {
  const content = block.content as DialogueContent
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [wordsUsed, setWordsUsed] = useState<Set<string>>(new Set())
  const allWordsUsedFired = useRef(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const targetWords = content.target_words || []

  useEffect(() => {
    fetch(`/api/dialogue?blockId=${block.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
          // Scan existing messages for used target words
          const used = new Set<string>()
          data.messages.forEach((m: ChatMessage) => {
            targetWords.forEach((w) => {
              if (m.content.toLowerCase().includes(w.toLowerCase())) {
                used.add(w.toLowerCase())
              }
            })
          })
          setWordsUsed(used)
        } else if (content.starter_message) {
          setMessages([{ role: 'assistant', content: content.starter_message }])
        }
        setLoadingHistory(false)
      })
      .catch(() => {
        if (content.starter_message) {
          setMessages([{ role: 'assistant', content: content.starter_message }])
        }
        setLoadingHistory(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    // Check for newly used words
    const newUsed = new Set(wordsUsed)
    targetWords.forEach((w) => {
      if (text.toLowerCase().includes(w.toLowerCase())) {
        newUsed.add(w.toLowerCase())
      }
    })
    setWordsUsed(newUsed)

    try {
      const res = await fetch('/api/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId: block.id,
          message: text,
          targetWords,
          scenario: content.scenario,
          chatHistory: newMessages,
        }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
      if (data.wordsUsed) {
        // Use newUsed (which includes client-detected words) instead of stale wordsUsed
        const merged = new Set(newUsed)
        data.wordsUsed.forEach((w: string) => merged.add(w.toLowerCase()))
        setWordsUsed(merged)
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setSending(false)
    }
  }

  const usedCount = targetWords.filter((w) => wordsUsed.has(w.toLowerCase())).length
  const progressPct = targetWords.length > 0 ? (usedCount / targetWords.length) * 100 : 0

  // Fire completion callback when all target words are used
  useEffect(() => {
    if (targetWords.length > 0 && usedCount === targetWords.length && !allWordsUsedFired.current) {
      allWordsUsedFired.current = true
      onAllWordsUsed?.()
    }
  }, [usedCount, targetWords.length, onAllWordsUsed])

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#416ebe] text-sm">Loading conversation...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      {/* Scenario */}
      <div className="bg-[#e6f0fa] rounded-xl p-3 mb-3">
        <p className="text-xs text-[#416ebe] font-bold mb-1">Scenario</p>
        <p className="text-sm text-[#46464b]">{content.scenario}</p>
      </div>

      {/* Target words pills */}
      {targetWords.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-gray-400 font-bold">Target words</p>
            <span className="text-xs text-[#416ebe]">
              {usedCount}/{targetWords.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {targetWords.map((w) => {
              const used = wordsUsed.has(w.toLowerCase())
              return (
                <span
                  key={w}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    used
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  {used && '✓ '}{w}
                </span>
              )
            })}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#416ebe] text-white rounded-br-md'
                  : 'bg-white border-2 border-[#cddcf0] text-[#46464b] rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border-2 border-[#cddcf0] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="Type your message..."
          className="flex-1 border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] transition-colors"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="bg-[#416ebe] hover:bg-[#3560b0] text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── Main Page Component ──

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [lessonType, setLessonType] = useState<string>('lesson')
  const [exercises, setExercises] = useState<LessonExercise[]>([])
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [flashcardMode, setFlashcardMode] = useState<FlashcardMode>('flip')
  const [selectedExercise, setSelectedExercise] = useState<LessonExercise | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set())
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set())
  const [flashcardsCompleted, setFlashcardsCompleted] = useState(false)
  const [writingText, setWritingText] = useState('')
  const [writingSaved, setWritingSaved] = useState(false)
  const [pointsToast, setPointsToast] = useState<number | null>(null)

  const studentName = session?.user?.name?.split(' ')[0] || 'Student'
  const studentEmail = session?.user?.email || ''

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }

    if (status === 'authenticated') {
      fetch(`/api/lessons?id=${id}`)
        .then((res) => res.json())
        .then((data) => {
          setLesson(data.lesson)
          setLessonType(data.lesson?.lesson_type || 'lesson')
          setFlashcards(
            (data.flashcards || []).map((f: Flashcard & { order_index: number }, i: number) => ({
              ...f,
              id: f.id || i + 1,
            }))
          )
          setExercises((data.exercises || []).map((ex: LessonExercise) => ({
            ...ex,
            // For group_sort, the questions column stores groupData
            groupData: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.groupData,
          })))
          setBlocks(
            (data.blocks || []).sort(
              (a: ContentBlock, b: ContentBlock) => a.order_index - b.order_index
            )
          )
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [status, id, router])

  // ── Load existing progress for this lesson ──
  useEffect(() => {
    if (!studentEmail || exercises.length === 0 && blocks.length === 0) return

    fetch(`/api/progress?email=${encodeURIComponent(studentEmail)}`)
      .then((res) => res.json())
      .then((data) => {
        const progress = data.progress || []
        // Mark completed exercises
        const exerciseIds = new Set(exercises.map((e: LessonExercise) => e.id))
        const completedEx = new Set<string>()
        const completedBl = new Set<string>()
        const blockIds = new Set(blocks.map((b: ContentBlock) => b.id))

        progress.forEach((p: { activity_type: string; activity_id: string }) => {
          if (p.activity_type === 'exercise' && exerciseIds.has(p.activity_id)) {
            completedEx.add(p.activity_id)
          }
          if (p.activity_type === 'block' && blockIds.has(p.activity_id)) {
            completedBl.add(p.activity_id)
          }
          if (p.activity_type === 'flashcard') {
            setFlashcardsCompleted(true)
          }
          // Writing submissions also count as block completion
          if (p.activity_type === 'writing' && blockIds.has(p.activity_id)) {
            completedBl.add(p.activity_id)
          }
        })
        setCompletedExerciseIds(completedEx)
        setCompletedBlockIds(completedBl)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentEmail, exercises.length, blocks.length])

  // ── Progress & notification helpers ──

  const handleBlockComplete = async (blockId: string, score?: number, total?: number) => {
    const newCompleted = new Set(completedBlockIds)
    newCompleted.add(blockId)
    setCompletedBlockIds(newCompleted)

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'block',
          activity_id: blockId,
          score: score ?? null,
          total: total ?? null,
        }),
      })
    } catch {}
  }

  const handleFlashcardComplete = async (results: {
    mode: string
    score?: number
    total: number
    knewCount?: number
  }) => {
    setFlashcardsCompleted(true)
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'flashcard',
          activity_id: results.mode,
          score: results.score ?? results.knewCount ?? null,
          total: results.total,
        }),
      })
    } catch {}

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail,
          studentName,
          event: 'session_complete',
          ...results,
        }),
      })
    } catch {}
  }

  const handleExerciseComplete = async (score: number, total: number) => {
    if (!selectedExercise) return

    const newCompleted = new Set(completedExerciseIds)
    newCompleted.add(selectedExercise.id)
    setCompletedExerciseIds(newCompleted)

    // Calculate points earned
    const ppa = selectedExercise.points_per_answer ?? 10
    const cb = selectedExercise.completion_bonus ?? 0
    const pointsEarned = (score * ppa) + cb

    // Show points toast
    if (pointsEarned > 0) {
      setPointsToast(pointsEarned)
      setTimeout(() => setPointsToast(null), 4000)
    }

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'exercise',
          activity_id: selectedExercise.id,
          score,
          total,
          points_earned: pointsEarned,
        }),
      })
    } catch {}

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail,
          studentName,
          event: 'exercise_complete',
          exerciseTitle: selectedExercise.title,
          score,
          total,
          points_earned: pointsEarned,
        }),
      })
    } catch {}
  }

  const handleWritingSubmit = async () => {
    if (!selectedBlock || !writingText.trim()) return
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'writing',
          activity_id: selectedBlock.id,
          score: null,
          total: null,
          response_text: writingText,
        }),
      })
      setWritingSaved(true)
      // Mark block as completed
      const newCompleted = new Set(completedBlockIds)
      newCompleted.add(selectedBlock.id)
      setCompletedBlockIds(newCompleted)
    } catch {}

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail,
          studentName,
          event: 'writing_submitted',
          blockTitle: selectedBlock.title,
          wordCount: writingText.trim().split(/\s+/).length,
        }),
      })
    } catch {}
  }

  // ── Loading / not found ──

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading lesson...</div>
      </main>
    )
  }

  if (!lesson) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm text-gray-400">Lesson not found</p>
          <button
            onClick={() => router.push('/home')}
            className="mt-4 text-sm text-[#416ebe] hover:underline"
          >
            ← Back to home
          </button>
        </div>
      </main>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // ── Helper: back button to overview ──
  const BackToLesson = () => (
    <button
      onClick={() => {
        setView('overview')
        setSelectedBlock(null)
        setSelectedExercise(null)
        setWritingText('')
        setWritingSaved(false)
      }}
      className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
    >
      ← Back to lesson
    </button>
  )

  // ── Extract YouTube video ID ──
  const getYouTubeId = (url: string) => {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/
    )
    return match ? match[1] : null
  }

  // ══════════════════════════════════════
  //  EXERCISE RUNNER VIEW
  // ══════════════════════════════════════

  // Points toast overlay
  const PointsToast = () =>
    pointsToast !== null ? (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-sm">
          <span className="text-lg">+{pointsToast}</span> points earned!
        </div>
      </div>
    ) : null

  if (view === 'exercise-runner' && selectedExercise) {
    const onBackToExercises = () => {
      setSelectedExercise(null)
      setView('overview')
    }

    const exType = selectedExercise.exercise_type
    const exProps = {
      title: selectedExercise.title,
      instructions: selectedExercise.instructions,
      questions: selectedExercise.questions,
    }

    let runnerContent: React.ReactNode = null
    const mainCls = "min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto"

    if (exType === 'true_or_false') {
      runnerContent = <TrueOrFalseRunner exercise={exProps} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'hangman') {
      runnerContent = <HangmanRunner exercise={exProps} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'type_answer') {
      runnerContent = <TypeAnswerRunner exercise={exProps} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'complete_sentence') {
      runnerContent = <CompleteSentenceRunner exercise={exProps} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'group_sort') {
      runnerContent = <GroupSortRunner exercise={{ title: exProps.title, instructions: exProps.instructions, groupData: selectedExercise.groupData || selectedExercise.questions }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'dictation') {
      runnerContent = <DictationRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and type what you hear.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'error_correction') {
      runnerContent = <ErrorCorrectionRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Find and correct the errors in each sentence.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'rank_order') {
      runnerContent = <RankOrderRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Drag or use arrows to rank the items in the correct order.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'text_sequencing') {
      runnerContent = <TextSequencingRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Arrange the segments in the correct order.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'anagram') {
      runnerContent = <AnagramRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Unscramble the letters to form the correct word.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'cloze_listening') {
      runnerContent = <ClozeListeningRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and fill in the missing words.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else if (exType === 'match_halves') {
      runnerContent = <MatchHalvesRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Match the halves by dragging tiles to the correct definitions.' }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    } else {
      // Default: classic ExerciseRunner for multiple_choice, fill_blank, etc.
      runnerContent = <ExerciseRunner exercise={{ id: 0, title: selectedExercise.title, subtitle: selectedExercise.subtitle, icon: selectedExercise.icon, instructions: selectedExercise.instructions, questions: selectedExercise.questions }} onComplete={handleExerciseComplete} onBack={onBackToExercises} />
    }

    return (
      <>
        <PointsToast />
        <main className={mainCls}>
          {runnerContent}
        </main>
      </>
    )
  }

  // ══════════════════════════════════════
  //  FLASHCARDS VIEW
  // ══════════════════════════════════════

  if (view === 'flashcards') {
    const flashcardsForMode = flashcards.map((f, i) => ({
      id: i + 1,
      word: f.word,
      phonetic: f.phonetic,
      meaning: f.meaning,
      example: f.example,
      notes: f.notes,
    }))

    const modeButtons: { key: FlashcardMode; label: string; description: string }[] = [
      { key: 'flip', label: 'Flip', description: 'Tap to reveal' },
      { key: 'self-assess', label: 'Self-Assess', description: 'Know it or not?' },
      { key: 'quiz', label: 'Quiz', description: 'Multiple choice' },
    ]

    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <BackToLesson />
            <h1 className="text-xl font-bold text-[#416ebe]">New Words</h1>
            <p className="text-xs text-gray-400">{lesson.title}</p>
          </div>
          <span className="text-xs text-gray-400 bg-[#e6f0fa] px-3 py-1 rounded-full">
            {flashcards.length} words
          </span>
        </div>

        <div className="flex gap-2 mb-6 bg-[#e6f0fa] p-1.5 rounded-xl">
          {modeButtons.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setFlashcardMode(key)}
              className={`flex-1 py-3 px-2 rounded-lg text-xs font-bold transition-all ${
                flashcardMode === key
                  ? 'bg-white text-[#416ebe] shadow-sm'
                  : 'text-[#46464b] hover:text-[#416ebe]'
              }`}
            >
              <div>{label}</div>
              <div className="font-normal mt-0.5 text-gray-400">{description}</div>
            </button>
          ))}
        </div>

        {flashcardMode === 'flip' && (
          <FlipMode
            cards={flashcardsForMode}
            onComplete={(total) => handleFlashcardComplete({ mode: 'flip', total })}
          />
        )}
        {flashcardMode === 'self-assess' && (
          <SelfAssessMode
            cards={flashcardsForMode}
            userEmail={studentEmail}
            onComplete={(knewCount, total) =>
              handleFlashcardComplete({ mode: 'self-assess', knewCount, total })
            }
          />
        )}
        {flashcardMode === 'quiz' && (
          <QuizMode
            cards={flashcardsForMode}
            userEmail={studentEmail}
            onComplete={(score, total) =>
              handleFlashcardComplete({ mode: 'quiz', score, total })
            }
          />
        )}
      </main>
    )
  }

  // ══════════════════════════════════════
  //  EXERCISES LIST VIEW
  // ══════════════════════════════════════

  if (view === 'exercises') {
    const mandatoryExercises = exercises.filter(ex => ex.is_mandatory !== false)
    const bonusExercises = exercises.filter(ex => ex.is_mandatory === false)

    const renderExerciseCard = (ex: LessonExercise, isBonus?: boolean) => {
      const isDone = completedExerciseIds.has(ex.id)
      return (
        <button
          key={ex.id}
          onClick={() => {
            setSelectedExercise(ex)
            setView('exercise-runner')
          }}
          className={`bg-white rounded-2xl border-2 p-5 text-left transition-all group flex items-center gap-4 ${
            isDone
              ? 'border-green-300 hover:border-green-400'
              : 'border-[#cddcf0] hover:border-[#416ebe]'
          }`}
        >
          <div className="text-3xl">{isDone ? '✅' : ex.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-bold group-hover:text-[#3560b0] ${
                  isDone ? 'text-green-600' : 'text-[#416ebe]'
                }`}
              >
                {ex.title}
              </h3>
              {isBonus && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">Bonus</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isDone ? 'Completed — tap to redo' : ex.subtitle}
            </p>
          </div>
          <div
            className={`text-xs px-2.5 py-1 rounded-full ${
              isDone ? 'text-green-600 bg-green-50' : 'text-gray-300 bg-[#e6f0fa]'
            }`}
          >
            {isDone ? 'Done' : `${ex.questions.length} Qs`}
          </div>
        </button>
      )
    }

    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('overview')}
            className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#416ebe]">Exercises</h1>
            <p className="text-xs text-gray-400">{lesson.title}</p>
          </div>
        </div>

        {/* Mandatory exercises */}
        {mandatoryExercises.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {mandatoryExercises.map(ex => renderExerciseCard(ex))}
          </div>
        )}

        {/* Bonus exercises */}
        {bonusExercises.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-3 mt-2">
              <div className="flex-1 h-px bg-[#e6f0fa]" />
              <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">Bonus Exercises</span>
              <div className="flex-1 h-px bg-[#e6f0fa]" />
            </div>
            <div className="flex flex-col gap-3">
              {bonusExercises.map(ex => renderExerciseCard(ex, true))}
            </div>
          </>
        )}

        {exercises.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
            <div className="text-4xl mb-3">✏️</div>
            <p className="text-sm text-gray-400">No exercises for this lesson yet.</p>
          </div>
        )}
      </main>
    )
  }

  // ══════════════════════════════════════
  //  BLOCK VIEW
  // ══════════════════════════════════════

  if (view === 'block' && selectedBlock) {
    const meta = BLOCK_META[selectedBlock.block_type] || { icon: '📦', label: selectedBlock.title }

    // ── Mistakes Block ──
    if (selectedBlock.block_type === 'mistakes') {
      const content = selectedBlock.content as MistakesContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          <div className="space-y-4">
            {content.mistakes.map((m, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                        Incorrect
                      </span>
                    </div>
                    <p className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 border border-red-200">
                      {m.original}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                        Correct
                      </span>
                    </div>
                    <p className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 border border-green-200">
                      {m.correction}
                    </p>
                  </div>
                </div>

                <div className="bg-[#e6f0fa] rounded-lg px-3 py-2">
                  <p className="text-xs text-[#46464b]">
                    <span className="font-bold text-[#416ebe]">Why? </span>
                    {m.explanation}
                  </p>
                </div>

                {m.practice && m.practice.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-[#416ebe] mb-2">Quick practice</p>
                    <InlineQuiz questions={m.practice} onComplete={(s, t) => handleBlockComplete(selectedBlock.id, s, t)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      )
    }

    // ── Video Block ──
    if (selectedBlock.block_type === 'video') {
      const content = selectedBlock.content as VideoContent
      const videoId = getYouTubeId(content.youtube_url)

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          {videoId ? (
            <div className="relative w-full pb-[56.25%] mb-6 rounded-2xl overflow-hidden bg-black">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-2xl p-8 text-center mb-6">
              <p className="text-sm text-gray-400">Video not available</p>
            </div>
          )}

          {content.questions && content.questions.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#416ebe] mb-3">Comprehension questions</h2>
              <InlineQuiz questions={content.questions} onComplete={(s, t) => handleBlockComplete(selectedBlock.id, s, t)} />
            </div>
          )}
        </main>
      )
    }

    // ── Article Block ──
    if (selectedBlock.block_type === 'article') {
      const content = selectedBlock.content as ArticleContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 mb-6">
            <div className="text-sm text-[#46464b] leading-relaxed whitespace-pre-wrap">
              {content.text}
            </div>
            {content.source && (
              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100 italic">
                Source: {content.source}
              </p>
            )}
          </div>

          {content.questions && content.questions.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#416ebe] mb-3">Comprehension questions</h2>
              <InlineQuiz questions={content.questions} onComplete={(s, t) => handleBlockComplete(selectedBlock.id, s, t)} />
            </div>
          )}
        </main>
      )
    }

    // ── Dialogue Block ──
    if (selectedBlock.block_type === 'dialogue') {
      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          <DialogueChat
            block={selectedBlock}
            studentEmail={studentEmail}
            studentName={studentName}
            onAllWordsUsed={() => handleBlockComplete(selectedBlock.id)}
          />
        </main>
      )
    }

    // ── Grammar Block ──
    if (selectedBlock.block_type === 'grammar') {
      const content = selectedBlock.content as GrammarContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          {/* Rule explanation */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 mb-4">
            <h2 className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-3">
              Rule
            </h2>
            <p className="text-sm text-[#46464b] leading-relaxed whitespace-pre-wrap">
              {content.explanation}
            </p>
          </div>

          {/* Examples */}
          {content.examples && content.examples.length > 0 && (
            <div className="bg-[#e6f0fa] rounded-2xl p-5 mb-4">
              <h2 className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-3">
                Examples
              </h2>
              <ul className="space-y-2">
                {content.examples.map((ex, i) => (
                  <li
                    key={i}
                    className="text-sm text-[#46464b] bg-white rounded-lg px-3 py-2 border border-[#cddcf0]"
                  >
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Practice exercises */}
          {content.exercises && content.exercises.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#416ebe] mb-3">Practice</h2>
              <InlineQuiz questions={content.exercises} onComplete={(s, t) => handleBlockComplete(selectedBlock.id, s, t)} />
            </div>
          )}
        </main>
      )
    }

    // ── Writing Block ──
    if (selectedBlock.block_type === 'writing') {
      const content = selectedBlock.content as WritingContent
      const wordCount = writingText.trim() ? writingText.trim().split(/\s+/).length : 0

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          {/* Prompt */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 mb-4">
            <h2 className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-2">
              Writing prompt
            </h2>
            <p className="text-sm text-[#46464b] leading-relaxed">{content.prompt}</p>
          </div>

          {/* Guidelines */}
          {content.guidelines && (
            <div className="bg-[#e6f0fa] rounded-xl p-4 mb-4">
              <h2 className="text-xs font-bold text-[#416ebe] mb-1">Guidelines</h2>
              <p className="text-xs text-[#46464b] leading-relaxed whitespace-pre-wrap">
                {content.guidelines}
              </p>
            </div>
          )}

          {/* Textarea */}
          <div className="relative mb-2">
            <textarea
              value={writingText}
              onChange={(e) => {
                setWritingText(e.target.value)
                setWritingSaved(false)
              }}
              placeholder="Start writing here..."
              rows={10}
              className="w-full border-2 border-[#cddcf0] rounded-2xl p-4 text-sm text-[#46464b] leading-relaxed resize-y focus:outline-none focus:border-[#416ebe] transition-colors"
            />
          </div>

          {/* Word count & submit */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold ${
                  content.word_limit && wordCount > content.word_limit
                    ? 'text-red-500'
                    : 'text-gray-400'
                }`}
              >
                {wordCount} {content.word_limit ? `/ ${content.word_limit}` : ''} words
              </span>
              {content.word_limit && (
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      wordCount > content.word_limit ? 'bg-red-400' : 'bg-[#416ebe]'
                    }`}
                    style={{
                      width: `${Math.min((wordCount / content.word_limit) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            {writingSaved && (
              <span className="text-xs text-green-500 font-bold">Saved!</span>
            )}
          </div>

          <button
            onClick={handleWritingSubmit}
            disabled={!writingText.trim() || writingSaved}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {writingSaved ? 'Submitted' : 'Submit writing'}
          </button>
        </main>
      )
    }

    // ── Pronunciation Block ──
    if (selectedBlock.block_type === 'pronunciation') {
      const content = selectedBlock.content as PronunciationContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-gray-400">{lesson.title}</p>
            </div>
          </div>

          <div className="space-y-3">
            {content.words.map((w, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <AudioButton text={w.word} />
                  <div>
                    <h3 className="text-base font-bold text-[#416ebe]">{w.word}</h3>
                    <p className="text-xs text-gray-400">{w.phonetic}</p>
                  </div>
                </div>
                {w.tips && (
                  <div className="bg-[#e6f0fa] rounded-lg px-3 py-2 mt-2">
                    <p className="text-xs text-[#46464b]">
                      <span className="font-bold text-[#416ebe]">Tip: </span>
                      {w.tips}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      )
    }

    // ── Fallback for unknown block types ──
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <BackToLesson />
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-sm text-gray-400">
            This content type is not yet supported.
          </p>
        </div>
      </main>
    )
  }

  // ══════════════════════════════════════
  //  LESSON OVERVIEW
  // ══════════════════════════════════════

  // Build ordered content items for overview — merge all types and sort by order_index
  // so students see content in the same order the admin arranged it.
  const contentItems: {
    key: string
    icon: string
    label: string
    subtitle: string
    onClick: () => void
    orderIndex: number
    completed: boolean
  }[] = []

  // Vocabulary card — use first flashcard's order_index / 1000 for global position
  const isTest = lessonType !== 'lesson'
  if (flashcards.length > 0 && !isTest) {
    const globalOrder = Math.floor((flashcards[0].order_index ?? 0) / 1000)
    contentItems.push({
      key: 'vocab',
      icon: flashcardsCompleted ? '✅' : '🃏',
      label: 'New Words',
      subtitle: flashcardsCompleted ? 'Studied — tap to review' : `${flashcards.length} words to learn`,
      onClick: () => setView('flashcards'),
      orderIndex: globalOrder,
      completed: flashcardsCompleted,
    })
  }

  // Exercise cards
  exercises.forEach((ex) => {
    const isDone = completedExerciseIds.has(ex.id)
    contentItems.push({
      key: `exercise-${ex.id}`,
      icon: isDone ? '✅' : ex.icon,
      label: ex.title,
      subtitle: isDone ? 'Completed — tap to redo' : ex.subtitle,
      onClick: () => {
        setSelectedExercise(ex)
        setView('exercise-runner')
      },
      orderIndex: ex.order_index ?? 0,
      completed: isDone,
    })
  })

  // Block cards
  blocks.forEach((block) => {
    const meta = BLOCK_META[block.block_type] || { icon: '📦', label: block.title }
    const isDone = completedBlockIds.has(block.id)
    contentItems.push({
      key: `block-${block.id}`,
      icon: isDone ? '✅' : meta.icon,
      label: block.title || meta.label,
      subtitle: isDone ? 'Completed — tap to review' : meta.label,
      onClick: () => {
        setSelectedBlock(block)
        setWritingText('')
        setWritingSaved(false)
        setView('block')
      },
      orderIndex: block.order_index,
      completed: isDone,
    })
  })

  // Sort by the unified order_index
  contentItems.sort((a, b) => a.orderIndex - b.orderIndex)

  const completedCount = contentItems.filter(i => i.completed).length
  const totalCount = contentItems.length
  const allComplete = totalCount > 0 && completedCount === totalCount

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Back button */}
        <button
          onClick={() => router.push('/home')}
          className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4"
        >
          ← Back to lessons
        </button>

        {/* Lesson Header */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-[#cddcf0] p-6 mb-4">
          <p className="text-xs text-gray-400 mb-1">{formatDate(lesson.lesson_date)}</p>
          <h1 className="text-xl font-bold text-[#416ebe] mb-2">
            {lesson.title}
            {lessonType !== 'lesson' && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-600 align-middle">
                {lessonType === 'mid_course_test' ? '📝 Mid-Course Test' : lessonType === 'final_test' ? '🎓 Final Test' : '🔄 Review Test'}
              </span>
            )}
          </h1>
          {lesson.summary && (
            <p className="text-sm text-gray-500 leading-relaxed">{lesson.summary}</p>
          )}
        </div>

        {/* Progress Header */}
        {totalCount > 0 && (
          <div className={`rounded-2xl p-4 mb-4 transition-all ${
            allComplete
              ? 'bg-gradient-to-r from-green-400 to-emerald-500'
              : 'bg-white border-2 border-[#cddcf0]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-bold ${allComplete ? 'text-white' : 'text-[#46464b]'}`}>
                {allComplete ? 'Lesson complete!' : 'Your progress'}
              </span>
              <span className={`text-xs font-bold ${allComplete ? 'text-green-100' : 'text-[#416ebe]'}`}>
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="flex gap-1">
              {contentItems.map((item) => (
                <div
                  key={item.key}
                  className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    item.completed
                      ? allComplete ? 'bg-white/70' : 'bg-green-400'
                      : allComplete ? 'bg-white/30' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content Cards */}
        {contentItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            {contentItems.map((item) => (
              <button
                key={item.key}
                onClick={item.onClick}
                className={`bg-white rounded-2xl shadow-sm border-2 p-5 text-left transition-all group flex items-center gap-4 ${
                  item.completed
                    ? 'border-green-200 hover:border-green-400'
                    : 'border-[#cddcf0] hover:border-[#416ebe]'
                }`}
              >
                <div className="text-3xl">{item.icon}</div>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold group-hover:text-[#3560b0] ${
                    item.completed ? 'text-green-600' : 'text-[#416ebe]'
                  }`}>
                    {item.label}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{item.subtitle}</p>
                </div>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-[#416ebe] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-sm text-gray-400">No content for this lesson yet.</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">englishwithlaura.com</p>
      </div>
    </main>
  )
}
