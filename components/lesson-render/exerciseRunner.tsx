'use client'

import { useState, lazy, Suspense } from 'react'
import type { Exercise } from '@/lib/lesson-editor/types'

// Lazy load exercise runners — only loaded when an exercise is opened.
// Lifted verbatim from app/lessons/[id]/page.tsx (the runner lazy-imports used
// by the standalone dispatch + block follow-up runner).
const ExerciseRunner = lazy(() => import('@/components/ExerciseRunner'))
const TrueOrFalseRunner = lazy(() => import('@/components/TrueOrFalseRunner'))
const HangmanRunner = lazy(() => import('@/components/HangmanRunner'))
const TypeAnswerRunner = lazy(() => import('@/components/TypeAnswerRunner'))
const CompleteSentenceRunner = lazy(() => import('@/components/CompleteSentenceRunner'))
const GroupSortRunner = lazy(() => import('@/components/GroupSortRunner'))
const DictationRunner = lazy(() => import('@/components/DictationRunner'))
const ErrorCorrectionRunner = lazy(() => import('@/components/ErrorCorrectionRunner'))
const RankOrderRunner = lazy(() => import('@/components/RankOrderRunner'))
const TextSequencingRunner = lazy(() => import('@/components/TextSequencingRunner'))
const AnagramRunner = lazy(() => import('@/components/AnagramRunner'))
const ClozeListeningRunner = lazy(() => import('@/components/ClozeListeningRunner'))
const MatchHalvesRunner = lazy(() => import('@/components/MatchHalvesRunner'))
const OddOneOutRunner = lazy(() => import('@/components/OddOneOutRunner'))
const GapFillRunner = lazy(() => import('@/components/GapFillRunner'))

export const ExerciseLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-brandblue text-sm">Loading exercise...</div>
  </div>
)

// ── Standalone 14-type runner dispatch ──
// Extracted verbatim from the exercise-runner view so the same dispatch can be
// reused by media-block follow-ups (BlockExercisesRunner). Behaviour is
// identical to the previous inline chain: derives exType/exProps from the
// passed exercise and wires onComplete/onBack into each runner.
export interface StandaloneRunnerExercise {
  title: string
  subtitle: string
  icon: string
  instructions: string
  exercise_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupData?: any
  test_type?: string | null
}

export function renderStandaloneRunner(
  exercise: StandaloneRunnerExercise,
  onComplete: (score: number, total: number, perQuestionResults?: boolean[]) => void,
  onBack: () => void
): React.ReactNode {
  const exType = exercise.exercise_type
  const exProps = {
    title: exercise.title,
    instructions: exercise.instructions,
    questions: exercise.questions,
    // Exam mode: runners suppress ALL correctness feedback while test_type is
    // set (TestSession forces it for test lessons). Runners that predate the
    // field simply ignore it.
    test_type: exercise.test_type ?? null,
  }

  if (exType === 'true_or_false') {
    return <TrueOrFalseRunner exercise={exProps} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'hangman') {
    return <HangmanRunner exercise={exProps} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'type_answer') {
    return <TypeAnswerRunner exercise={exProps} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'complete_sentence') {
    return <CompleteSentenceRunner exercise={exProps} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'group_sort') {
    return <GroupSortRunner exercise={{ title: exProps.title, instructions: exProps.instructions, groupData: exercise.groupData || exercise.questions }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'dictation') {
    return <DictationRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and type what you hear.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'error_correction') {
    return <ErrorCorrectionRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Find and correct the errors in each sentence.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'rank_order') {
    return <RankOrderRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Drag or use arrows to rank the items in the correct order.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'text_sequencing') {
    return <TextSequencingRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Arrange the segments in the correct order.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'anagram' || exType === 'unjumble') {
    return <AnagramRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Unscramble the letters to form the correct word.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'cloze_listening') {
    return <ClozeListeningRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Listen and fill in the missing words.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'match_halves') {
    return <MatchHalvesRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Match the halves by dragging tiles to the correct definitions.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'odd_one_out') {
    return <OddOneOutRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Find the word or phrase that doesn\'t belong.' }} onComplete={onComplete} onBack={onBack} />
  } else if (exType === 'gap_fill') {
    return <GapFillRunner exercise={{ ...exProps, instructions: exProps.instructions || 'Fill each gap, then check.' }} onComplete={onComplete} onBack={onBack} />
  } else {
    // Default: classic ExerciseRunner for multiple_choice, fill_blank, etc.
    return <ExerciseRunner exercise={{ id: 0, title: exercise.title, subtitle: exercise.subtitle, icon: exercise.icon, instructions: exercise.instructions, questions: exercise.questions, test_type: exercise.test_type }} onComplete={onComplete} onBack={onBack} />
  }
}

// ── Block follow-up exercises runner (unified model) ──
// Renders a media block's follow-up Exercise[] using the standalone 14-type
// dispatch, aggregating per-exercise scores into a single onScore callback —
// the same score-aggregation shell AttachedExercisesRunner uses. Each child's
// onBack is a no-op (embedded, no nav).
export function BlockExercisesRunner({
  exercises,
  onScore,
}: {
  exercises: Exercise[]
  onScore: (score: number, total: number) => void
}) {
  const [scores, setScores] = useState<Record<string, { score: number; total: number }>>({})

  const reportScore = (exId: string, score: number, total: number) => {
    setScores((prev) => {
      const next = { ...prev, [exId]: { score, total } }
      let s = 0
      let t = 0
      for (const v of Object.values(next)) {
        s += v.score
        t += v.total
      }
      onScore(s, t)
      return next
    })
  }

  if (exercises.length === 0) return null

  return (
    <div className="space-y-4">
      {exercises.map((ex, i) => {
        const key = ex.id || String(i)
        return (
          <div key={key} className="bg-white border border-sky-border rounded-card p-4">
            <p className="text-[10px] font-bold text-brandblue uppercase tracking-wider mb-3">
              {ex.icon} {ex.title}
            </p>
            <Suspense fallback={<ExerciseLoadingFallback />}>
              {renderStandaloneRunner(
                ex,
                (s, t) => reportScore(key, s, t),
                () => { /* embedded — no back nav */ }
              )}
            </Suspense>
          </div>
        )
      })}
    </div>
  )
}
