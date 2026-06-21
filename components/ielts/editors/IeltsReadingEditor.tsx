'use client'

// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — TEACHER authoring editor (block-editor contract).
//
// ADDITIVE: not imported by any live file. The `ielts_reading` block's content
// is a ReadingExercise (see lib/ielts/types.ts). This editor reads
// block.content as that shape and writes every change back via
//   onChange({ ...block, title, content })
// so the host block editor persists it verbatim into the lesson JSON.
//
// Sections:
//   • block TITLE                 — the task name ("Reading: Urban bees")
//   • PASSAGE                     — optional title + a paragraphs editor
//                                   (add / edit / optional label / reorder / delete)
//   • INSTRUCTIONS                — the exercise-level instruction line
//   • QUESTION GROUPS             — a list of question sets, each rendered via the
//                                   per-kind editor from groupEditorRegistry, in a
//                                   card with instruction + reorder + delete; an
//                                   "+ Add question set" menu appends defaultGroup(kind).
//
// Gating: callers should only mount this when IELTS_ENABLED (lib/ielts/registry).
// This component does not re-check the flag — it is a pure editor.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

import type {
  ReadingExercise,
  ReadingPassage,
  ReadingParagraph,
  ReadingQuestionGroup,
  ReadingQuestionKind,
} from '@/lib/ielts/types'

import { Button, Eyebrow, Pill } from '@/components/student-ui'

import {
  GROUP_EDITOR_REGISTRY,
  GROUP_EDITOR_KINDS,
  makeDefaultGroup,
} from './groupEditorRegistry'

// ── Block contract ──────────────────────────────────────────────────────────
//
// Structural shape of the host's ContentBlock (lib/lesson-editor/types.ts). We
// keep a local, additive shape rather than importing the live BlockType union
// (which does not yet list 'ielts_reading') so this file touches no live types.
// `content` is read as a ReadingExercise.

export interface IeltsReadingBlock {
  id?: string
  block_type: string
  title: string
  content: unknown
  order_index?: number
  [key: string]: unknown
}

export interface IeltsReadingEditorProps {
  block: IeltsReadingBlock
  onChange: (block: IeltsReadingBlock) => void
}

// ── Defaults / coercion ──────────────────────────────────────────────────────

const emptyExercise = (): ReadingExercise => ({
  passage: { paragraphs: [] },
  instructions: '',
  questionGroups: [],
})

/** Read block.content as a ReadingExercise, defaulting an empty/invalid value. */
function readExercise(content: unknown): ReadingExercise {
  if (!content || typeof content !== 'object') return emptyExercise()
  const c = content as Partial<ReadingExercise>
  return {
    passage:
      c.passage && Array.isArray(c.passage.paragraphs)
        ? c.passage
        : { paragraphs: [] },
    instructions: typeof c.instructions === 'string' ? c.instructions : '',
    questionGroups: Array.isArray(c.questionGroups) ? c.questionGroups : [],
  }
}

// ── Typed per-kind dispatch ───────────────────────────────────────────────────
//
// Renders the registry Editor for a group's own kind. The cast bridges the
// dynamic lookup to the kind-specific props; it is sound because we look the
// entry up BY the group's own discriminant, so entry.Editor matches `group`.

function GroupEditorDispatch({
  group,
  onChange,
}: {
  group: ReadingQuestionGroup
  onChange: (group: ReadingQuestionGroup) => void
}) {
  const entry = GROUP_EDITOR_REGISTRY[group.kind]
  const Editor = entry.Editor as React.ComponentType<{
    group: ReadingQuestionGroup
    onChange: (group: ReadingQuestionGroup) => void
  }>
  return <Editor group={group} onChange={onChange} />
}

// ── Main editor ────────────────────────────────────────────────────────────────

export default function IeltsReadingEditor({
  block,
  onChange,
}: IeltsReadingEditorProps) {
  const exercise = readExercise(block.content)
  const { passage, instructions, questionGroups } = exercise

  const [showAddMenu, setShowAddMenu] = useState(false)

  /** Write a new exercise (and optional title) back through the block contract. */
  const commit = (next: ReadingExercise, title: string = block.title) => {
    onChange({ ...block, title, content: next })
  }

  const setTitle = (title: string) => commit(exercise, title)

  // ── Passage ──
  const setPassage = (next: ReadingPassage) =>
    commit({ ...exercise, passage: next })

  const setPassageTitle = (title: string) =>
    setPassage({ ...passage, title })

  const patchParagraph = (idx: number, p: Partial<ReadingParagraph>) => {
    const paragraphs = passage.paragraphs.map((para, i) =>
      i === idx ? { ...para, ...p } : para,
    )
    setPassage({ ...passage, paragraphs })
  }

  const addParagraph = () => {
    // Suggest the next margin letter (A, B, C…) based on count.
    const letter = String.fromCharCode(65 + passage.paragraphs.length)
    const nextLabel = passage.paragraphs.length < 26 ? letter : ''
    setPassage({
      ...passage,
      paragraphs: [...passage.paragraphs, { label: nextLabel, text: '' }],
    })
  }

  const removeParagraph = (idx: number) => {
    setPassage({
      ...passage,
      paragraphs: passage.paragraphs.filter((_, i) => i !== idx),
    })
  }

  const moveParagraph = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= passage.paragraphs.length) return
    const paragraphs = [...passage.paragraphs]
    ;[paragraphs[idx], paragraphs[target]] = [
      paragraphs[target],
      paragraphs[idx],
    ]
    setPassage({ ...passage, paragraphs })
  }

  // ── Instructions ──
  const setInstructions = (value: string) =>
    commit({ ...exercise, instructions: value })

  // ── Question groups ──
  const setGroup = (idx: number, group: ReadingQuestionGroup) => {
    const next = questionGroups.map((g, i) => (i === idx ? group : g))
    commit({ ...exercise, questionGroups: next })
  }

  const setGroupInstruction = (idx: number, instruction: string) => {
    const g = questionGroups[idx]
    setGroup(idx, { ...g, instruction } as ReadingQuestionGroup)
  }

  const addGroup = (kind: ReadingQuestionKind) => {
    commit({
      ...exercise,
      questionGroups: [...questionGroups, makeDefaultGroup(kind)],
    })
    setShowAddMenu(false)
  }

  const removeGroup = (idx: number) => {
    commit({
      ...exercise,
      questionGroups: questionGroups.filter((_, i) => i !== idx),
    })
  }

  const moveGroup = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= questionGroups.length) return
    const next = [...questionGroups]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commit({ ...exercise, questionGroups: next })
  }

  // ── Render ──
  return (
    <div className="font-rubik flex flex-col gap-6">
      {/* Task title */}
      <section>
        <label className="block">
          <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
            Task title
          </span>
          <input
            type="text"
            value={block.title}
            placeholder="Reading: Urban bees"
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
          />
        </label>
      </section>

      {/* Passage */}
      <section className="flex flex-col gap-3">
        <Eyebrow>Reading passage</Eyebrow>

        <label className="block">
          <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
            Passage title (optional)
          </span>
          <input
            type="text"
            value={passage.title ?? ''}
            placeholder="The Hidden Lives of Urban Bees"
            onChange={(e) => setPassageTitle(e.target.value)}
            className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
          />
        </label>

        <div className="flex flex-col gap-2">
          {passage.paragraphs.map((para, idx) => (
            <div
              key={idx}
              className="rounded-tile border border-hairline bg-surface p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={para.label ?? ''}
                  placeholder="Label"
                  aria-label={`Paragraph ${idx + 1} label`}
                  onChange={(e) => patchParagraph(idx, { label: e.target.value })}
                  className="w-20 text-[14px] font-extrabold text-sky-dark bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                />
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  Paragraph {idx + 1}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveParagraph(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move paragraph up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveParagraph(idx, 1)}
                    disabled={idx === passage.paragraphs.length - 1}
                    aria-label="Move paragraph down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="textLink"
                    size="sm"
                    onClick={() => removeParagraph(idx)}
                    aria-label="Delete paragraph"
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <textarea
                value={para.text}
                rows={4}
                placeholder="Paragraph text…"
                onChange={(e) => patchParagraph(idx, { text: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky resize-y leading-relaxed"
              />
            </div>
          ))}
          {passage.paragraphs.length === 0 && (
            <p className="text-[13px] text-ink-muted">No paragraphs yet.</p>
          )}
          <div>
            <Button variant="secondary" size="sm" onClick={addParagraph}>
              + Add paragraph
            </Button>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="flex flex-col gap-2">
        <Eyebrow>Exercise instructions</Eyebrow>
        <textarea
          value={instructions}
          rows={2}
          placeholder="Read the passage and answer the questions below."
          onChange={(e) => setInstructions(e.target.value)}
          className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky resize-y leading-relaxed"
        />
      </section>

      {/* Question groups */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>Question sets</Eyebrow>
          <span className="text-[12px] text-ink-muted">
            {questionGroups.length} set{questionGroups.length === 1 ? '' : 's'}
          </span>
        </div>

        {questionGroups.map((group, idx) => {
          const entry = GROUP_EDITOR_REGISTRY[group.kind]
          return (
            <div
              key={group.id || idx}
              className="rounded-card border border-hairline bg-white p-4 flex flex-col gap-3"
            >
              {/* Card header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill variant="wash">{entry.label}</Pill>
                  {!entry.editable && (
                    <span className="text-[11px] font-bold text-ink-muted">
                      preview-only
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveGroup(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move question set up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveGroup(idx, 1)}
                    disabled={idx === questionGroups.length - 1}
                    aria-label="Move question set down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="textLink"
                    size="sm"
                    onClick={() => removeGroup(idx)}
                    aria-label="Delete question set"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Group instruction */}
              <label className="block">
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                  Instruction line
                </span>
                <textarea
                  value={group.instruction}
                  rows={2}
                  placeholder="Choose the correct letter, A, B, C or D."
                  onChange={(e) => setGroupInstruction(idx, e.target.value)}
                  className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky resize-y leading-relaxed"
                />
              </label>

              {/* Per-kind editor */}
              <GroupEditorDispatch
                group={group}
                onChange={(g) => setGroup(idx, g)}
              />
            </div>
          )
        })}

        {questionGroups.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            No question sets yet. Add one below.
          </p>
        )}

        {/* Add question set */}
        <div className="relative">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddMenu((v) => !v)}
            aria-expanded={showAddMenu}
          >
            + Add question set
          </Button>

          {showAddMenu && (
            <div className="mt-2 rounded-card border border-hairline bg-white p-2 shadow-[0_4px_16px_rgba(15,22,40,0.10)] flex flex-col gap-0.5 max-w-sm">
              {GROUP_EDITOR_KINDS.map((kind) => {
                const entry = GROUP_EDITOR_REGISTRY[kind]
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addGroup(kind)}
                    className="flex items-center justify-between gap-2 text-left text-[14px] font-medium text-ink-body rounded-tile px-3 py-2 hover:bg-sky-wash transition-colors"
                  >
                    <span>{entry.label}</span>
                    {!entry.editable && (
                      <span className="text-[11px] font-bold text-ink-muted shrink-0">
                        preview-only
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
