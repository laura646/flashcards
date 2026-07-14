'use client'

import { useState, useEffect, useRef, use, lazy, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { detectUsedTargets } from '@/lib/word-detection'
import type { ReadingExercise } from '@/lib/ielts/types'
import type { Exercise } from '@/lib/lesson-editor/types'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import {
  renderStandaloneRunner,
  ExerciseLoadingFallback,
} from '@/components/lesson-render/exerciseRunner'
import { MistakesView } from '@/components/lesson-render/blocks/MistakesView'
import { isTestLessonType } from '@/lib/test-mode'
import TestSession from '@/components/TestSession'
import { VideoView } from '@/components/lesson-render/blocks/VideoView'
import { AudioView } from '@/components/lesson-render/blocks/AudioView'
import { ArticleView } from '@/components/lesson-render/blocks/ArticleView'
import { GrammarView } from '@/components/lesson-render/blocks/GrammarView'
import { WritingView } from '@/components/lesson-render/blocks/WritingView'
import { PronunciationView } from '@/components/lesson-render/blocks/PronunciationView'

// Lazy load flashcard runners — only loaded when student opens flashcards.
// The 14 exercise runners now live in components/lesson-render/exerciseRunner.
const FlipMode = lazy(() => import('@/components/FlipMode'))
const SelfAssessMode = lazy(() => import('@/components/SelfAssessMode'))
const QuizMode = lazy(() => import('@/components/QuizMode'))
const IeltsReadingBlockView = lazy(() => import('@/components/ielts/IeltsReadingBlockView'))

// ── Interfaces ──

interface Flashcard {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes?: string
  image_url?: string
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
  test_type?: string | null
}

// State of a test attempt for the current student. Computed when they tap
// a test-tagged exercise — drives whether we show the runner or a locked
// screen.
type TestAttemptStatus = 'started' | 'already_submitted' | 'already_started'
interface TestAttempt {
  activity_id: string
  score: number | null
  total: number | null
  started_at: string | null
  completed_at: string | null
  per_question_results: boolean[] | null
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
  // Unified model: video follow-ups are full standalone Exercise[] (migrated
  // in at load via migrateBlockExercises). `questions` kept for migration only.
  exercises?: Exercise[]
}

interface AudioContent {
  audio_url: string
  // Unified model: audio follow-ups are full standalone Exercise[] (migrated
  // in at load via migrateBlockExercises).
  exercises?: Exercise[]
}

interface ArticleContent {
  text: string
  source?: string
  questions: { id: number; prompt: string; options: string[]; correctIndex: number }[]
  // Unified model: article follow-ups are full standalone Exercise[] (migrated
  // in at load via migrateBlockExercises). `questions` kept for migration only.
  exercises?: Exercise[]
}

interface DialogueContent {
  scenario: string
  target_words: string[]
  starter_message: string
}

interface GrammarPitfall { mistake: string; correct: string; tip: string }
interface GrammarContent {
  explanation: string
  examples: string[]
  exercises: { id: number; prompt: string; options: string[]; correctIndex: number }[]
  // Phase R-3 additions — all optional for backward compat.
  target_structure?: string
  example_highlights?: string[]
  practice_exercises?: import('@/lib/attached-exercise').AttachedExercise[]
  pitfalls?: GrammarPitfall[]
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
  block_type: 'mistakes' | 'video' | 'audio' | 'article' | 'dialogue' | 'grammar' | 'writing' | 'pronunciation' | 'ielts_reading'
  title: string
  content: MistakesContent | VideoContent | AudioContent | ArticleContent | DialogueContent | GrammarContent | WritingContent | PronunciationContent | ReadingExercise
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
  audio: { icon: '🎧', label: 'Listen & Understand' },
  article: { icon: '📄', label: 'Read & Understand' },
  dialogue: { icon: '💬', label: 'Conversation Practice' },
  grammar: { icon: '📐', label: 'Grammar Focus' },
  writing: { icon: '✍️', label: 'Writing Task' },
  pronunciation: { icon: '🔊', label: 'Pronunciation Practice' },
}

// ── Dialogue Chat Component ──

interface Correction { original: string; correct: string; why?: string }
interface DialogueChatMessage extends ChatMessage {
  corrections?: Correction[]
}

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
  const [messages, setMessages] = useState<DialogueChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [wordsUsed, setWordsUsed] = useState<Set<string>>(new Set())
  const allWordsUsedFired = useRef(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Mic / Whisper state ──
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordPressStartRef = useRef<number>(0)
  const pressStartedRecordingRef = useRef<boolean>(false)
  const recordStreamRef = useRef<MediaStream | null>(null)

  // Track which assistant message indices have already auto-played their
  // TTS, so existing chat history doesn't blast 10 messages on load.
  const autoPlayedRef = useRef<Set<number>>(new Set())

  // End-of-session report state (Tier 3).
  const [finishing, setFinishing] = useState(false)
  const [report, setReport] = useState<null | {
    total_target_words: number
    used_words: string[]
    top_corrections: { original: string; correct: string; why?: string }[]
    encouragement: string
    next_practice: string
  }>(null)
  const blockCompleteFiredRef = useRef(false)

  const targetWords = content.target_words || []

  useEffect(() => {
    fetch(`/api/dialogue?blockId=${block.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
          // Treat all loaded history as already-played so we don't auto-play it.
          for (let i = 0; i < data.messages.length; i++) autoPlayedRef.current.add(i)
          // Scan existing messages for used target words (lemma-aware
          // so historical "ran" credits "run" on reload too).
          const used = new Set<string>()
          data.messages.forEach((m: ChatMessage) => {
            if (m.role !== 'user') return // only the student's turns count
            detectUsedTargets(m.content, targetWords).forEach((w) => used.add(w.toLowerCase()))
          })
          setWordsUsed(used)
        } else if (content.starter_message) {
          setMessages([{ role: 'assistant', content: content.starter_message }])
          autoPlayedRef.current.add(0) // don't auto-play starter — already on screen
        }
        setLoadingHistory(false)
      })
      .catch(() => {
        if (content.starter_message) {
          setMessages([{ role: 'assistant', content: content.starter_message }])
          autoPlayedRef.current.add(0)
        }
        setLoadingHistory(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-play any NEW assistant message that arrives (skips history).
  useEffect(() => {
    if (loadingHistory) return
    const lastIdx = messages.length - 1
    if (lastIdx < 0) return
    const last = messages[lastIdx]
    if (last.role !== 'assistant') return
    if (autoPlayedRef.current.has(lastIdx)) return
    autoPlayedRef.current.add(lastIdx)
    playMessageAudio(last.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loadingHistory])

  const playMessageAudio = async (text: string) => {
    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'echo' }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      // Browser autoplay policies require user activation. The first
      // message playback might be blocked silently — that's fine; the
      // student can click the 🔊 button on the message to replay.
      audio.play().catch(() => { URL.revokeObjectURL(url) })
    } catch { /* ignore */ }
  }

  // ── Mic recording ──
  const startRecording = async () => {
    setMicError(null) // clear any stale error from a previous attempt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      // Use the recorder's reported mimeType so Safari (which produces
      // audio/mp4) doesn't get its blob mislabelled as audio/webm and
      // confuse Whisper.
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        recordStreamRef.current?.getTracks().forEach((t) => t.stop())
        recordStreamRef.current = null
        const mimeType = mr.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []
        if (blob.size === 0) { setRecording(false); return }
        setRecording(false)
        setTranscribing(true)
        try {
          const fd = new FormData()
          // Pick a sensible filename extension matching the codec so
          // Whisper can identify it on the server side.
          const ext = mimeType.includes('mp4') ? 'm4a'
            : mimeType.includes('mpeg') ? 'mp3'
            : mimeType.includes('wav') ? 'wav'
            : mimeType.includes('ogg') ? 'ogg'
            : 'webm'
          fd.append('audio', blob, `recording.${ext}`)
          const res = await fetch('/api/speech-to-text', { method: 'POST', body: fd })
          const data = await res.json()
          if (res.ok && typeof data.text === 'string') {
            setInput((prev) => (prev ? prev + ' ' + data.text : data.text))
          } else {
            setMicError(data.error || 'Could not transcribe')
          }
        } catch {
          setMicError('Could not transcribe')
        }
        setTranscribing(false)
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    } catch {
      setMicError('Microphone permission denied or unavailable')
      setRecording(false)
    }
  }

  const stopRecording = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      try { mr.stop() } catch { /* ignore */ }
    }
  }

  // Dual-mode mic button — tap toggles, hold-and-release is push-to-talk.
  const handleMicPointerDown = () => {
    recordPressStartRef.current = Date.now()
    if (!recording) {
      pressStartedRecordingRef.current = true
      startRecording()
    } else {
      // Already recording: this is the second tap that will stop on up.
      pressStartedRecordingRef.current = false
    }
  }
  const handleMicPointerUp = () => {
    const held = Date.now() - recordPressStartRef.current
    if (pressStartedRecordingRef.current) {
      // Started in this press cycle.
      if (held >= 300) {
        // Push-to-talk: stop on release.
        stopRecording()
      }
      // Else: tap. Leave recording — next tap will stop.
      pressStartedRecordingRef.current = false
    } else if (recording) {
      // Second-tap stop.
      stopRecording()
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: DialogueChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    // Optimistic detection using the same lemma-aware logic the server
    // runs — so the UI doesn't briefly disagree with the server's
    // verdict. detectUsedTargets returns the SUBSET of targetWords (in
    // their original casing) that were used.
    const newUsed = new Set(wordsUsed)
    const clientDetected = detectUsedTargets(text, targetWords)
    clientDetected.forEach((w) => newUsed.add(w.toLowerCase()))
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
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      // fetch() doesn't throw on HTTP error statuses — we have to check
      // res.ok ourselves and surface a visible failure, otherwise the
      // user just sees their message and then silence.
      const replyText = typeof data.message === 'string' && data.message.trim()
        ? data.message
        : !res.ok
          ? `Sorry — ${typeof data.error === 'string' ? data.error : `the AI request failed (HTTP ${res.status})`}. Try sending again.`
          : "Sorry, I didn't catch that — could you say it again?"
      setMessages([...newMessages, {
        role: 'assistant',
        content: replyText,
        corrections: Array.isArray(data.corrections) ? data.corrections : [],
      }])
      if (data.wordsUsed) {
        const merged = new Set(newUsed)
        ;(data.wordsUsed as string[]).forEach((w: string) => merged.add(w.toLowerCase()))
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
      blockCompleteFiredRef.current = true
      onAllWordsUsed?.()
    }
  }, [usedCount, targetWords.length, onAllWordsUsed])

  // Tier 3: end the session, ask the API for a recap, show it as a modal,
  // and mark the block complete (even if not every target word was used).
  const finishSession = async () => {
    if (finishing || messages.length === 0) return
    setFinishing(true)
    try {
      const res = await fetch('/api/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', blockId: block.id, targetWords }),
      })
      const data = await res.json()
      if (!res.ok) {
        // No-op — keep the chat open if generation fails.
        setFinishing(false)
        return
      }
      setReport({
        total_target_words: targetWords.length,
        used_words: Array.isArray(data.used_words) ? data.used_words : [],
        top_corrections: Array.isArray(data.top_corrections) ? data.top_corrections : [],
        encouragement: data.encouragement || '',
        next_practice: data.next_practice || '',
      })
      // Mark the block complete on explicit finish — even with incomplete word coverage.
      if (!blockCompleteFiredRef.current) {
        blockCompleteFiredRef.current = true
        onAllWordsUsed?.()
      }
    } catch {
      // swallow — modal won't open
    }
    setFinishing(false)
  }

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-brandblue text-sm">Loading conversation...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      {/* Scenario + Finish session button */}
      <div className="bg-sky-wash rounded-xl p-3 mb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-brandblue font-bold mb-1">Scenario</p>
          <p className="text-sm text-ink-body">{content.scenario}</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={finishSession}
            disabled={finishing}
            className="shrink-0 text-[11px] font-bold text-brandblue hover:text-[#3560b0] disabled:opacity-50 underline"
            title="End session and see a quick recap"
          >
            {finishing ? 'Wrapping up…' : 'Finish session ▸'}
          </button>
        )}
      </div>

      {/* Target words pills */}
      {targetWords.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-ink-muted font-bold">Target words</p>
            <span className="text-xs text-brandblue">
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
                      : 'bg-gray-100 text-ink-muted border border-gray-200'
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
        {messages.filter((m) => m.content && m.content.trim()).map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky text-white rounded-br-md'
                    : 'bg-white border-[1.5px] border-sky-border text-ink-body rounded-bl-md'
                }`}
              >
                <div>{msg.content}</div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => playMessageAudio(msg.content)}
                    title="Listen"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-brandblue hover:text-[#3560b0] font-bold"
                  >
                    🔊 Listen
                  </button>
                )}
              </div>
            </div>
            {/* Corrections panel — only on assistant turns that have any */}
            {msg.role === 'assistant' && (msg as DialogueChatMessage).corrections && (msg as DialogueChatMessage).corrections!.length > 0 && (
              <div className="mt-1.5 ml-1 max-w-[80%] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Watch out for</p>
                <ul className="space-y-1">
                  {(msg as DialogueChatMessage).corrections!.map((c, ci) => (
                    <li key={ci} className="text-xs">
                      <span className="text-red-500 line-through mr-1">{c.original}</span>
                      <span className="text-ink-muted mx-0.5">→</span>
                      <span className="text-green-700 font-medium ml-1">{c.correct}</span>
                      {c.why && <p className="text-[11px] text-amber-700 mt-0.5">{c.why}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border-[1.5px] border-sky-border rounded-2xl rounded-bl-md px-4 py-3">
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

      {/* Mic error toast */}
      {micError && (
        <div className="mb-2 text-[11px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {micError}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onPointerDown={handleMicPointerDown}
          onPointerUp={handleMicPointerUp}
          onPointerLeave={handleMicPointerUp}
          disabled={sending || transcribing}
          title={recording ? 'Tap to stop · or release if holding' : 'Tap to speak · or hold push-to-talk'}
          aria-label="Microphone"
          className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            recording
              ? 'bg-red-500 text-white animate-pulse'
              : transcribing
                ? 'bg-gray-200 text-ink-muted'
                : 'bg-sky-wash text-sky hover:bg-sky-border'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {transcribing ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            // Microphone glyph
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 11-9 0v-.357z" />
            </svg>
          )}
        </button>
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
          placeholder={recording ? 'Recording — tap mic again to stop…' : transcribing ? 'Transcribing…' : 'Type or speak your message…'}
          className="flex-1 border-[1.5px] border-sky-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky transition-colors"
          disabled={sending || transcribing}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending || transcribing}
          className="bg-sky hover:brightness-95 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>

      {/* ── End-of-session report modal (Tier 3) ── */}
      {report && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-hairline">
              <p className="text-[11px] font-bold text-brandblue uppercase tracking-wider">Session report</p>
              <h3 className="text-base font-bold text-ink-body mt-1">{studentName ? `Great work, ${studentName}!` : 'Great work!'}</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Words used */}
              {report.total_target_words > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-2">
                    Words used <span className="text-brandblue">{report.used_words.length} / {report.total_target_words}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {targetWords.map((w) => {
                      const used = report.used_words.some((u) => u.toLowerCase() === w.toLowerCase())
                      return (
                        <span key={w} className={`text-xs px-2.5 py-1 rounded-full font-medium ${used ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-ink-muted border border-gray-200'}`}>
                          {used && '✓ '}{w}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Top corrections */}
              {report.top_corrections.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-2">Watch out for</p>
                  <ul className="space-y-2">
                    {report.top_corrections.map((c, i) => (
                      <li key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <div className="text-sm">
                          <span className="text-red-500 line-through mr-1">{c.original}</span>
                          <span className="text-ink-muted mx-1">→</span>
                          <span className="text-green-700 font-medium ml-1">{c.correct}</span>
                        </div>
                        {c.why && <p className="text-[11px] text-amber-700 mt-1">{c.why}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Encouragement */}
              {report.encouragement && (
                <p className="text-sm text-ink-body bg-sky-wash rounded-lg px-3 py-2 italic">{report.encouragement}</p>
              )}
              {/* Next practice */}
              {report.next_practice && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">For next time</p>
                  <p className="text-sm text-ink-body">{report.next_practice}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end">
              <button
                onClick={() => setReport(null)}
                className="bg-sky hover:brightness-95 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
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

  // Test-lock state: only relevant when selectedExercise.test_type is set.
  // 'loading' = waiting for the test-attempt API response.
  // 'started' = fresh start, render runner normally.
  // 'already_submitted' = locked, show score + per-question review.
  // 'already_started' = locked, show "contact teacher to reset" message.
  const [testAttemptStatus, setTestAttemptStatus] = useState<
    'loading' | 'started' | 'already_submitted' | 'already_started' | 'error' | null
  >(null)
  const [testAttempt, setTestAttempt] = useState<TestAttempt | null>(null)
  const [testAttemptError, setTestAttemptError] = useState<string>('')
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set())
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set())
  const [flashcardsCompleted, setFlashcardsCompleted] = useState(false)
  const [writingText, setWritingText] = useState('')
  const [writingSaved, setWritingSaved] = useState(false)
  // W2: teacher's grade + feedback on this student's writing, keyed by block id.
  type WritingFeedbackItem = {
    progress_id: string; block_id: string; score_pct: number | null; cefr_band: string | null
    rubric: Record<string, number> | null; feedback: string | null; graded_at: string; student_seen_at: string | null
  }
  const [writingFeedback, setWritingFeedback] = useState<Record<string, WritingFeedbackItem>>({})
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
          // Issue #6: hide unpublished blocks/exercises from students.
          // `flashcards_published === false` hides the whole vocab block.
          // For exercises and blocks, filter out rows where published === false.
          const flashcardsHidden = data.lesson?.flashcards_published === false
          setFlashcards(
            flashcardsHidden
              ? []
              : (data.flashcards || []).map((f: Flashcard & { order_index: number }, i: number) => ({
                  ...f,
                  id: f.id || i + 1,
                }))
          )
          setExercises(
            (data.exercises || [])
              .filter((ex: LessonExercise & { published?: boolean }) => ex.published !== false)
              .map((ex: LessonExercise) => ({
                ...ex,
                // For group_sort, the questions column stores groupData
                groupData: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.groupData,
                test_type: ex.test_type || null,
              }))
          )
          setBlocks(
            (data.blocks || [])
              .filter((b: ContentBlock & { published?: boolean }) => b.published !== false)
              .sort(
                (a: ContentBlock, b: ContentBlock) => a.order_index - b.order_index
              )
              // Migrate media-block follow-ups (legacy questions + bare
              // AttachedExercise) onto the unified Exercise[] model at load so
              // the article/video/audio renders are uniform. Video carries
              // legacy MCQ via `questions`; audio has no legacy MCQ field.
              .map((b: ContentBlock) => {
                if (b.block_type === 'article') {
                  const c = b.content as ArticleContent
                  const migrated = migrateBlockExercises(c.exercises, c.questions)
                  return { ...b, content: { ...c, exercises: migrated } }
                }
                if (b.block_type === 'video') {
                  const c = b.content as VideoContent
                  const migrated = migrateBlockExercises(c.exercises, c.questions)
                  return { ...b, content: { ...c, exercises: migrated } }
                }
                if (b.block_type === 'audio') {
                  const c = b.content as AudioContent
                  const migrated = migrateBlockExercises(c.exercises, undefined)
                  return { ...b, content: { ...c, exercises: migrated } }
                }
                return b
              })
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
          if (p.activity_type === 'flashcard' && (p.activity_id === `${id}:flip` || p.activity_id === `${id}:self-assess` || p.activity_id === `${id}:quiz`)) {
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

  // W2: load this student's own writing grades/feedback (keyed by block id).
  useEffect(() => {
    if (!studentEmail) return
    fetch('/api/writing-feedback?mine=1')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, WritingFeedbackItem> = {}
        for (const f of d?.feedback || []) if (f?.block_id) map[f.block_id] = f
        setWritingFeedback(map)
      })
      .catch(() => {})
  }, [studentEmail])

  // W2: mark the open writing block's feedback as seen once the student views it.
  useEffect(() => {
    if (!selectedBlock || selectedBlock.block_type !== 'writing') return
    const f = writingFeedback[selectedBlock.id]
    if (!f || f.student_seen_at) return
    fetch('/api/writing-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-seen', progress_ids: [f.progress_id] }),
    }).catch(() => {})
    setWritingFeedback((prev) => ({ ...prev, [selectedBlock.id]: { ...f, student_seen_at: new Date().toISOString() } }))
  }, [selectedBlock, writingFeedback])

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
          activity_id: `${id}:${results.mode}`,
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

  // When a test-tagged exercise is selected, hit /api/test-attempt to either
  // start a new attempt (201) or learn that the student has already taken it
  // (409 with attempt details). Non-test exercises are untouched.
  useEffect(() => {
    if (!selectedExercise) {
      setTestAttemptStatus(null)
      setTestAttempt(null)
      setTestAttemptError('')
      return
    }
    if (!selectedExercise.test_type) {
      // Regular practice — no lock logic
      setTestAttemptStatus(null)
      setTestAttempt(null)
      return
    }

    let cancelled = false
    setTestAttemptStatus('loading')
    setTestAttemptError('')
    fetch('/api/test-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: selectedExercise.id }),
    })
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        if (res.status === 201) {
          setTestAttemptStatus('started')
          setTestAttempt(body.attempt || null)
        } else if (res.status === 409) {
          setTestAttemptStatus(body.status === 'already_submitted' ? 'already_submitted' : 'already_started')
          setTestAttempt(body.attempt || null)
        } else {
          setTestAttemptStatus('error')
          setTestAttemptError(body.error || 'Could not start test')
        }
      })
      .catch(() => {
        if (cancelled) return
        setTestAttemptStatus('error')
        setTestAttemptError('Network error starting test')
      })

    return () => {
      cancelled = true
    }
  }, [selectedExercise])

  // Helper for runners that want to report per-question right/wrong on submit.
  // Most runners just pass undefined for the third arg (we still store a null
  // per_question_results on the test row in that case).
  const handleExerciseComplete = async (
    score: number,
    total: number,
    perQuestionResults?: boolean[]
  ) => {
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

    // Tests use the test-attempt endpoint (PATCH the already-started row).
    // Regular practice uses /api/progress as before.
    const isTest = !!selectedExercise.test_type
    try {
      if (isTest) {
        await fetch('/api/test-attempt', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_id: selectedExercise.id,
            score,
            total,
            per_question_results: perQuestionResults ?? null,
          }),
        })
      } else {
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
      }
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
        <div className="text-brandblue text-sm">Loading lesson...</div>
      </main>
    )
  }

  if (!lesson) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm text-ink-muted">Lesson not found</p>
          <button
            onClick={() => router.push('/home')}
            className="mt-4 text-sm text-brandblue hover:underline"
          >
            ← Back to home
          </button>
        </div>
      </main>
    )
  }

  // ── EXAM MODE ──
  // Test lessons (mid_course / final / review) get the full exam experience:
  // rules gate → server-timed attempt → unified submit → results. The whole
  // per-exercise flow below is bypassed; TestSession drives the runners.
  if (isTestLessonType(lessonType) && exercises.length > 0) {
    return (
      <main className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
        <TestSession
          lessonId={id}
          lessonTitle={lesson.title}
          lessonType={lessonType}
          exercises={exercises}
          onExit={() => router.push('/home')}
        />
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
      className="text-xs text-ink-muted hover:text-sky transition-colors mb-1"
    >
      ← Back to lesson
    </button>
  )

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

    let runnerContent: React.ReactNode = null
    const mainCls = "min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto"

    // ─── Test-lock branching ─────────────────────────────────────
    // For test-tagged exercises, we override the normal runner with
    // a lock screen when the student has already opened or submitted.
    if (selectedExercise.test_type) {
      if (testAttemptStatus === 'loading' || testAttemptStatus === null) {
        runnerContent = (
          <div className="flex flex-col gap-4">
            <button onClick={onBackToExercises} className="text-sm text-ink-muted hover:text-sky transition-colors self-start">
              ← Back
            </button>
            <div className="text-center text-sm text-ink-muted mt-12">Preparing test…</div>
          </div>
        )
      } else if (testAttemptStatus === 'error') {
        runnerContent = (
          <div className="flex flex-col gap-4">
            <button onClick={onBackToExercises} className="text-sm text-ink-muted hover:text-sky transition-colors self-start">
              ← Back
            </button>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-sm font-bold text-red-600 mb-1">Could not open test</p>
              <p className="text-xs text-red-500">{testAttemptError || 'Please try again or contact your teacher.'}</p>
            </div>
          </div>
        )
      } else if (testAttemptStatus === 'already_started') {
        // Strict single-start: they opened it before but never submitted.
        // Locked. Only teacher can reset.
        runnerContent = (
          <div className="flex flex-col gap-4">
            <button onClick={onBackToExercises} className="text-sm text-ink-muted hover:text-sky transition-colors self-start">
              ← Back
            </button>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="text-4xl text-center mb-3">⏸️</div>
              <h2 className="text-base font-bold text-amber-700 text-center mb-2">Test attempt incomplete</h2>
              <p className="text-sm text-amber-700 text-center leading-relaxed">
                You opened this test on{' '}
                <span className="font-bold">
                  {testAttempt?.started_at
                    ? new Date(testAttempt.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'an earlier date'}
                </span>{' '}
                but didn&apos;t submit it. Tests can only be taken once.
              </p>
              <p className="text-xs text-amber-600 text-center mt-3">
                Please contact your teacher to reset your attempt.
              </p>
            </div>
          </div>
        )
      } else if (testAttemptStatus === 'already_submitted') {
        // Already submitted — show score + cheap per-question right/wrong review
        // (we don't show what they chose, just which questions they got right).
        const a = testAttempt
        const submittedPct = a?.score != null && a?.total ? Math.round((a.score / a.total) * 100) : null
        const submittedAtLabel = a?.completed_at
          ? new Date(a.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''
        // Compute correct-answer text per question for the review screen.
        // We rely on the same `questions` shape stored on the exercise.
        const reviewQuestions = Array.isArray(selectedExercise.questions) ? selectedExercise.questions : []
        const perResults = Array.isArray(a?.per_question_results) ? (a!.per_question_results as boolean[]) : []
        runnerContent = (
          <div className="flex flex-col gap-4">
            <button onClick={onBackToExercises} className="text-sm text-ink-muted hover:text-sky transition-colors self-start">
              ← Back
            </button>
            <div className="text-center py-2">
              <div className="text-5xl mb-3">
                {submittedPct != null ? (submittedPct >= 80 ? '🌟' : submittedPct >= 60 ? '👍' : '💪') : '📝'}
              </div>
              <h2 className="text-xl font-bold text-brandblue">Test completed</h2>
              <p className="text-sm text-ink-muted mt-1">
                {submittedPct != null ? <>You scored {a?.score}/{a?.total} ({submittedPct}%)</> : 'Score: not recorded'}
                {submittedAtLabel && <> · {submittedAtLabel}</>}
              </p>
              <p className="text-[10px] text-ink-muted mt-1">
                Tests can only be taken once. Contact your teacher if you need a retry.
              </p>
            </div>
            {perResults.length > 0 && reviewQuestions.length > 0 && (
              <div className="space-y-2">
                {reviewQuestions.map((q: { prompt?: string; options?: string[]; correctIndex?: number; answer?: string; correctIndices?: number[] }, i: number) => {
                  const correct = perResults[i] === true
                  // Derive a readable "correct answer" string per common shape.
                  let correctText = ''
                  if (Array.isArray(q.options) && Array.isArray(q.correctIndices)) {
                    correctText = q.correctIndices.map((idx) => q.options?.[idx]).filter(Boolean).join(', ')
                  } else if (Array.isArray(q.options) && typeof q.correctIndex === 'number') {
                    correctText = q.options[q.correctIndex] || ''
                  } else if (typeof q.answer === 'string') {
                    correctText = q.answer
                  }
                  return (
                    <div key={i} className={`bg-white rounded-xl border-2 p-3 ${correct ? 'border-green-200' : 'border-red-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-sm font-bold mt-0.5 ${correct ? 'text-green-500' : 'text-red-400'}`}>
                          {correct ? '✓' : '✗'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-ink-body">{q.prompt || `Question ${i + 1}`}</p>
                          {correctText && (
                            <p className="text-xs mt-1">
                              <span className="text-ink-muted">Correct: </span>
                              <span className="text-green-600 font-bold">{correctText}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {(perResults.length === 0 || reviewQuestions.length === 0) && (
              <p className="text-xs text-ink-muted text-center italic">
                Detailed per-question review is not available for this exercise.
              </p>
            )}
          </div>
        )
      }
      // else testAttemptStatus === 'started' → fall through to render the
      // normal runner below
    }

    if (!runnerContent) {
      runnerContent = renderStandaloneRunner(selectedExercise, handleExerciseComplete, onBackToExercises)
    } // end of if (!runnerContent) — skip the runner-selection chain when
      // the test-lock branch above already produced runnerContent

    return (
      <>
        <PointsToast />
        <main className={mainCls}>
          <Suspense fallback={<ExerciseLoadingFallback />}>
            {runnerContent}
          </Suspense>
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
      image_url: f.image_url,
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
            <h1 className="text-xl font-extrabold text-brandblue">New Words</h1>
            <p className="text-xs text-ink-muted">{lesson.title}</p>
          </div>
          <span className="text-[11px] font-bold text-ink-body bg-sky-wash px-3 py-1 rounded-full">
            {flashcards.length} words
          </span>
        </div>

        <div className="flex gap-1 mb-6 bg-sky-wash p-1 rounded-full">
          {modeButtons.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setFlashcardMode(key)}
              className={`flex-1 py-2.5 px-2 rounded-full text-xs font-bold transition-all ${
                flashcardMode === key
                  ? 'bg-white text-brandblue shadow-[0_1px_2px_rgba(15,22,40,0.08)]'
                  : 'text-ink-body hover:text-ink-black'
              }`}
            >
              <div>{label}</div>
              <div className={`font-normal mt-0.5 ${flashcardMode === key ? 'text-ink-muted' : 'text-ink-muted'}`}>{description}</div>
            </button>
          ))}
        </div>

        <Suspense fallback={<ExerciseLoadingFallback />}>
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
        </Suspense>
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
          className={`bg-white rounded-card border-[1.5px] p-5 text-left transition-all group flex items-center gap-4 ${
            isDone
              ? 'border-correct-border hover:border-correct-fg'
              : 'border-sky-border hover:border-sky'
          }`}
        >
          <div className="w-12 h-12 shrink-0 flex items-center justify-center text-2xl bg-sky-wash rounded-tile">{isDone ? '✅' : (ex.icon || '📝')}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-bold ${
                  isDone ? 'text-correct-fg' : 'text-brandblue'
                }`}
              >
                {ex.title || ({ multiple_choice: 'Multiple Choice', fill_blank: 'Fill in the Blank', match_halves: 'Match Halves', type_answer: 'Type the Answer', anagram: 'Unjumble', unjumble: 'Unjumble', true_or_false: 'True or False', hangman: 'Hangman', error_correction: 'Error Correction', complete_sentence: 'Complete the Sentence', group_sort: 'Group Sort', dictation: 'Dictation', rank_order: 'Rank Order', text_sequencing: 'Text Sequencing', transform: 'Transform', cloze_listening: 'Cloze Listening' } as Record<string, string>)[ex.exercise_type] || 'Exercise'}
              </h3>
              {isBonus && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">Bonus</span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {isDone ? 'Completed — tap to redo' : ex.subtitle}
            </p>
          </div>
          <div
            className={`text-xs px-2.5 py-1 rounded-full ${
              isDone ? 'text-green-600 bg-green-50' : 'text-[#c8ccd4] bg-sky-wash'
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
            className="text-sm text-ink-muted hover:text-sky transition-colors"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brandblue">Exercises</h1>
            <p className="text-xs text-ink-muted">{lesson.title}</p>
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
              <div className="flex-1 h-px bg-sky-wash" />
              <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">Bonus Exercises</span>
              <div className="flex-1 h-px bg-sky-wash" />
            </div>
            <div className="flex flex-col gap-3">
              {bonusExercises.map(ex => renderExerciseCard(ex, true))}
            </div>
          </>
        )}

        {exercises.length === 0 && (
          <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-8 text-center">
            <div className="text-4xl mb-3">✏️</div>
            <p className="text-sm text-ink-muted">No exercises for this lesson yet.</p>
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
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <MistakesView
            content={content}
            onScore={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
          />
        </main>
      )
    }

    // ── Video Block ──
    if (selectedBlock.block_type === 'video') {
      const content = selectedBlock.content as VideoContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <VideoView
            content={content}
            onScore={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
          />
        </main>
      )
    }

    // ── Audio Block ──
    if (selectedBlock.block_type === 'audio') {
      const content = selectedBlock.content as AudioContent

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <AudioView
            content={content}
            onScore={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
          />
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
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <ArticleView
            content={content}
            onScore={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
          />
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
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
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
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <GrammarView
            content={content}
            onScore={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
          />
        </main>
      )
    }

    // ── Writing Block ──
    if (selectedBlock.block_type === 'writing') {
      const content = selectedBlock.content as WritingContent
      const fb = writingFeedback[selectedBlock.id]

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <WritingView
            content={content}
            value={writingText}
            onChange={(v) => {
              setWritingText(v)
              setWritingSaved(false)
            }}
            saved={writingSaved}
            onSubmit={handleWritingSubmit}
          />

          {/* W2: teacher's grade + feedback (once graded) */}
          {fb && (
            <div className="mt-5 bg-white rounded-2xl border-[1.5px] border-correct-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-correct-fg uppercase tracking-wider">Teacher feedback</h2>
                {!fb.student_seen_at && (
                  <span className="text-[10px] font-bold bg-correct-bg text-correct-fg px-2 py-0.5 rounded-full">New</span>
                )}
              </div>
              {(fb.score_pct != null || fb.cefr_band) && (
                <div className="flex items-center gap-3 mb-3">
                  {fb.score_pct != null && <span className="text-2xl font-bold text-correct-fg leading-none">{fb.score_pct}%</span>}
                  {fb.cefr_band && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-wash text-sky-text">{fb.cefr_band}</span>}
                </div>
              )}
              {fb.rubric && Object.keys(fb.rubric).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(fb.rubric).map(([k, v]) => (
                    <span key={k} className="text-[11px] text-ink-body bg-sky-wash rounded-lg px-2 py-1">
                      <span className="capitalize">{k}</span> {v}/5
                    </span>
                  ))}
                </div>
              )}
              {fb.feedback && <p className="text-sm text-ink-body leading-relaxed whitespace-pre-wrap">{fb.feedback}</p>}
            </div>
          )}
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
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <PronunciationView content={content} />
        </main>
      )
    }

    // ── IELTS Reading Block ──
    if (selectedBlock.block_type === 'ielts_reading') {
      const content = selectedBlock.content as ReadingExercise

      return (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-5xl mx-auto">
          <BackToLesson />
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-brandblue">
                {selectedBlock.title || meta.label}
              </h1>
              <p className="text-xs text-ink-muted">{lesson.title}</p>
            </div>
          </div>

          <Suspense fallback={<ExerciseLoadingFallback />}>
            <IeltsReadingBlockView
              exercise={content}
              onComplete={(s, t) => handleBlockComplete(selectedBlock.id, s, t)}
            />
          </Suspense>
        </main>
      )
    }

    // ── Fallback for unknown block types ──
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <BackToLesson />
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-sm text-ink-muted">
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
  const EXERCISE_TYPE_ICONS: Record<string, string> = {
    multiple_choice: '🎯', fill_blank: '✍️', match_halves: '🧩', transform: '🔄',
    true_or_false: '✅', hangman: '🎮', type_answer: '⌨️', complete_sentence: '📝',
    group_sort: '🗂️', dictation: '🎧', error_correction: '🔍', rank_order: '🔢',
    text_sequencing: '📄', anagram: '🔀', unjumble: '🔀', cloze_listening: '🎧',
    odd_one_out: '🚫',
  }
  const EXERCISE_TYPE_NAMES: Record<string, string> = {
    multiple_choice: 'Multiple Choice', fill_blank: 'Fill in the Blank', match_halves: 'Match Halves',
    transform: 'Transform', true_or_false: 'True or False', hangman: 'Hangman',
    type_answer: 'Type the Answer', complete_sentence: 'Complete the Sentence',
    group_sort: 'Group Sort', dictation: 'Dictation', error_correction: 'Error Correction',
    rank_order: 'Rank Order', text_sequencing: 'Text Sequencing', anagram: 'Unjumble',
    unjumble: 'Unjumble', cloze_listening: 'Cloze Listening',
    odd_one_out: 'Odd One Out',
  }
  exercises.forEach((ex) => {
    const isDone = completedExerciseIds.has(ex.id)
    const fallbackIcon = EXERCISE_TYPE_ICONS[ex.exercise_type] || '📝'
    const fallbackTitle = EXERCISE_TYPE_NAMES[ex.exercise_type] || 'Exercise'
    const questionCount = Array.isArray(ex.questions) ? ex.questions.length : 0
    contentItems.push({
      key: `exercise-${ex.id}`,
      icon: isDone ? '✅' : (ex.icon || fallbackIcon),
      label: ex.title || fallbackTitle,
      subtitle: isDone ? 'Completed — tap to redo' : (ex.subtitle || `${questionCount} question${questionCount !== 1 ? 's' : ''}`),
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

  // Current/next activity = first incomplete item in sorted order (10B
  // highlight). Derived only from existing completion flags.
  const firstIncompleteKey = contentItems.find((item) => !item.completed)?.key

  return (
    <main className="min-h-screen bg-[#f9fafb] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Back button */}
        <button
          onClick={() => router.push('/home')}
          className="text-xs font-bold text-sky hover:underline mb-4"
        >
          ← Back to lessons
        </button>

        {/* Lesson Header */}
        <div className="bg-white rounded-card border border-hairline p-6 mb-4">
          <p className="text-xs text-ink-muted mb-1">{formatDate(lesson.lesson_date)}</p>
          <h1 className="text-xl font-extrabold text-brandblue mb-2">
            {lesson.title}
            {lessonType !== 'lesson' && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-wash text-ink-body align-middle">
                {lessonType === 'mid_course_test' ? '📝 Mid-Course Test' : lessonType === 'final_test' ? '🎓 Final Test' : '🔄 Review Test'}
              </span>
            )}
          </h1>
          {lesson.summary && (
            <p className="text-sm text-ink-muted leading-relaxed">{lesson.summary}</p>
          )}
        </div>

        {/* Progress Header */}
        {totalCount > 0 && (
          <div className="rounded-card p-4 mb-4 bg-white border border-hairline">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-ink-black">
                {allComplete ? 'Lesson complete! 🎉' : 'Your progress'}
              </span>
              <span className="text-xs font-bold text-sky">
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="flex gap-1.5">
              {contentItems.map((item) => (
                <div
                  key={item.key}
                  className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    item.completed ? 'bg-sky' : 'bg-[#eef1f6]'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content Cards */}
        {contentItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            {contentItems.map((item) => {
              const isCurrent = item.key === firstIncompleteKey
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className={`bg-white rounded-card p-5 text-left transition-all group flex items-center gap-4 border-[1.5px] ${
                    isCurrent
                      ? 'border-sky'
                      : 'border-hairline hover:border-sky'
                  }`}
                >
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center text-2xl bg-sky-wash rounded-tile">
                    {item.completed ? '✅' : item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-[15px] font-bold ${isCurrent ? 'text-brandblue' : 'text-ink-black'}`}>
                      {item.label}
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">{item.subtitle}</p>
                  </div>
                  <svg className="w-4 h-4 text-[#c8ccd4] group-hover:text-sky transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-card border border-hairline p-8 text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-sm text-ink-muted">No content for this lesson yet.</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-ink-muted">englishwithlaura.com</p>
      </div>
    </main>
  )
}
