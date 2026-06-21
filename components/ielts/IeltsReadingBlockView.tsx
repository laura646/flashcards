'use client'

// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — block view (student-facing).
//
// ADDITIVE. Renders a complete ReadingExercise as the `ielts_reading` content
// block: the passage on the left, the question groups on the right (split-screen
// on lg with each pane scrolling independently; stacked on mobile).
//
// Each group is dispatched to its matching student Runner (the exact kind→runner
// mapping copied from app/admin-beta/ielts-preview/page.tsx). Every runner
// reports its score via onScore(correct, total) when the learner presses Check.
//
// Aggregate completion: this view tracks each group's latest (correct, total).
// Once EVERY group has been checked at least once, it calls onComplete with the
// summed score — exactly ONCE. Re-checking a group after that (e.g. after a
// "Try again") updates the per-group score but does not fire onComplete again.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react'

import {
  ReadingMcqRunner,
  ReadingTfngRunner,
  ReadingYnngRunner,
  ReadingMatchingHeadingsRunner,
  ReadingMatchingInformationRunner,
  ReadingMatchingFeaturesRunner,
  ReadingMatchingSentenceEndingsRunner,
  ReadingSentenceCompletionRunner,
  ReadingNoteCompletionRunner,
  ReadingSummaryCompletionRunner,
  ReadingTableCompletionRunner,
  ReadingFlowChartCompletionRunner,
  ReadingDiagramLabelRunner,
  ReadingShortAnswerRunner,
} from '@/components/ielts/runners'

import type {
  ReadingExercise,
  ReadingPassage,
  ReadingQuestionGroup,
} from '@/lib/ielts/types'

export interface IeltsReadingBlockViewProps {
  exercise: ReadingExercise
  /** Fired once, after every group has been checked at least once. */
  onComplete?: (correct: number, total: number) => void
  className?: string
}

// ── kind → runner dispatch (copied verbatim from the preview page) ─────────────

function GroupRunner({
  group,
  onScore,
}: {
  group: ReadingQuestionGroup
  onScore: (correct: number, total: number) => void
}) {
  switch (group.kind) {
    case 'mcq':
      return <ReadingMcqRunner group={group} onScore={onScore} />
    case 'tfng':
      return <ReadingTfngRunner group={group} onScore={onScore} />
    case 'ynng':
      return <ReadingYnngRunner group={group} onScore={onScore} />
    case 'matching_headings':
      return <ReadingMatchingHeadingsRunner group={group} onScore={onScore} />
    case 'matching_information':
      return <ReadingMatchingInformationRunner group={group} onScore={onScore} />
    case 'matching_features':
      return <ReadingMatchingFeaturesRunner group={group} onScore={onScore} />
    case 'matching_sentence_endings':
      return (
        <ReadingMatchingSentenceEndingsRunner group={group} onScore={onScore} />
      )
    case 'sentence_completion':
      return <ReadingSentenceCompletionRunner group={group} onScore={onScore} />
    case 'note_completion':
      return <ReadingNoteCompletionRunner group={group} onScore={onScore} />
    case 'summary_completion':
      return <ReadingSummaryCompletionRunner group={group} onScore={onScore} />
    case 'table_completion':
      return <ReadingTableCompletionRunner group={group} onScore={onScore} />
    case 'flow_chart_completion':
      return <ReadingFlowChartCompletionRunner group={group} onScore={onScore} />
    case 'diagram_label_completion':
      return <ReadingDiagramLabelRunner group={group} onScore={onScore} />
    case 'short_answer':
      return <ReadingShortAnswerRunner group={group} onScore={onScore} />
    default: {
      // Exhaustiveness guard: if a new kind is added to the union, this errors
      // at compile time until a case above handles it.
      const _exhaustive: never = group
      return _exhaustive
    }
  }
}

// ── Passage panel (left / top column) ──────────────────────────────────────────

function PassagePanel({ passage }: { passage: ReadingPassage }) {
  return (
    <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="bg-white rounded-card border border-hairline p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky mb-2">
          Reading passage
        </p>
        {passage.title && (
          <h3 className="text-[17px] font-extrabold text-brandblue mb-3 leading-snug">
            {passage.title}
          </h3>
        )}
        <div className="space-y-3">
          {passage.paragraphs.map((p, i) => (
            <p
              key={p.label ?? `${i}-${p.text.slice(0, 8)}`}
              className="text-[13.5px] leading-relaxed text-ink-body"
            >
              {p.label && (
                <span className="inline-block font-extrabold text-sky mr-1.5">
                  {p.label}
                </span>
              )}
              {p.text}
            </p>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── Block view ─────────────────────────────────────────────────────────────────

export function IeltsReadingBlockView({
  exercise,
  onComplete,
  className = '',
}: IeltsReadingBlockViewProps) {
  const { passage, instructions, questionGroups } = exercise

  // Per-group latest score, keyed by group id. A key is present once that group
  // has been checked at least once.
  const scoresRef = useRef<Record<string, { correct: number; total: number }>>(
    {},
  )
  // Guard so onComplete fires at most once for this exercise instance.
  const completedRef = useRef(false)
  // Drives a re-render-free flow; we only need the ref values when aggregating.
  const [, forceTick] = useState(0)

  const totalGroups = questionGroups.length

  const handleGroupScore = useCallback(
    (groupId: string, correct: number, total: number) => {
      scoresRef.current[groupId] = { correct, total }

      // Fire onComplete only after every group has reported, and only once.
      if (
        !completedRef.current &&
        totalGroups > 0 &&
        Object.keys(scoresRef.current).length >= totalGroups
      ) {
        completedRef.current = true
        const summed = Object.values(scoresRef.current).reduce(
          (acc, s) => ({
            correct: acc.correct + s.correct,
            total: acc.total + s.total,
          }),
          { correct: 0, total: 0 },
        )
        onComplete?.(summed.correct, summed.total)
        // Surface the completion in the UI (banner below).
        forceTick((n) => n + 1)
      }
    },
    [onComplete, totalGroups],
  )

  const allChecked =
    totalGroups > 0 && Object.keys(scoresRef.current).length >= totalGroups

  // Empty state — no groups to render.
  if (totalGroups === 0) {
    return (
      <div className={`font-rubik ${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <PassagePanel passage={passage} />
          <div className="bg-white rounded-card border border-hairline p-5">
            {instructions && (
              <p className="text-[13px] leading-relaxed text-ink-muted bg-[#f7f8fa] border border-hairline rounded-tile px-3.5 py-2.5 mb-4">
                {instructions}
              </p>
            )}
            <p className="text-[13px] text-ink-muted">
              This exercise has no questions yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`font-rubik ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Passage — left on lg, scrolls independently */}
        <PassagePanel passage={passage} />

        {/* Questions — right on lg, scrolls independently */}
        <div className="lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          {instructions && (
            <p className="text-[14px] leading-relaxed text-ink-body font-semibold mb-4">
              {instructions}
            </p>
          )}

          <div className="space-y-6">
            {questionGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-card border border-hairline p-5"
              >
                <GroupRunner
                  group={group}
                  onScore={(correct, total) =>
                    handleGroupScore(group.id, correct, total)
                  }
                />
              </div>
            ))}
          </div>

          {allChecked && (
            <p
              role="status"
              className="text-[13px] text-correct-fg font-extrabold mt-6 text-center"
            >
              All sections checked.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default IeltsReadingBlockView
