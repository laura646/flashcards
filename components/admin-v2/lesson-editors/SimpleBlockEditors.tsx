'use client'

// 10B redesign — SIMPLE BLOCK content editors (Phase 2, "new beside old").
//
// Four presentational editors for the simple content blocks:
//   WritingEditor · PronunciationEditor · MistakesEditor · DialogueEditor
//
// Each is pure/presentational: it receives the current ContentBlock plus an
// onChange callback and never touches the editor store directly. Title edits
// go through onChange({ ...block, title }); content edits go through
// onChange({ ...block, content: ... }). The parent (LessonEditorView) wires
// onChange to the hook's updateContentItem, which replaces the item .data.
//
// Behaviour is ported FAITHFULLY from the legacy editor
// app/admin/lessons/page.tsx (cited line ranges below). Styling is the 10B kit
// (@/components/student-ui) + tokens; the legacy admin colours are not reused.
//
// DEFERRED (per Phase 2 scope): AI generation panels everywhere; the Dialogue
// "View student chats" button (legacy 3350-3361) is intentionally not rendered.

import { Button, Pill } from '@/components/student-ui'
import McqOptionsList from '@/components/McqOptionsList'
import type {
  ContentBlock,
  WritingContent,
  PronunciationContent,
  PronunciationWord,
  MistakesContent,
  Mistake,
  MistakePractice,
  DialogueContent,
} from '@/lib/lesson-editor/types'

// ── Shared props ──

interface Props {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
}

// ── Shared presentational helpers (10B tokens) ──

// Uppercase eyebrow label above a field (mirrors legacy 10px bold uppercase).
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

// 10B-styled text input. Width is controlled by the caller via className.
function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky ${className}`}
    />
  )
}

// 10B-styled textarea (mirrors the LessonEditorView summary textarea).
function TextArea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-24',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  heightClass?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${heightClass} text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-none border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]`}
    />
  )
}

// The block-title field, shared by every editor. Edits flow through
// onChange({ ...block, title }).
function TitleField({
  block,
  onChange,
  placeholder,
}: Props & { placeholder: string }) {
  return (
    <div>
      <FieldLabel>Block title</FieldLabel>
      <TextInput
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  )
}

// Sub-block card shell (e.g. each pronunciation word / mistake): a sky-wash
// tile with a "#n" eyebrow and a Remove button on the right.
function RepeaterCard({
  label,
  onRemove,
  children,
}: {
  label: React.ReactNode
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-sky-wash rounded-tile p-4 border border-hairline">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text">
          {label}
        </span>
        <Button variant="textLink" size="sm" onClick={onRemove} className="!text-incorrect-fg">
          Remove
        </Button>
      </div>
      {children}
    </div>
  )
}

// Dashed full-width "+ Add ..." button used to append a repeater row.
function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 border-2 border-dashed border-sky-border rounded-tile text-xs font-extrabold text-ink-muted hover:border-sky hover:text-sky transition-colors"
    >
      {label}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// WritingEditor (legacy renderWritingEditor, page.tsx 3551-3586)
//   content: { prompt, guidelines, word_limit }
// ════════════════════════════════════════════════════════════════

export function WritingEditor({ block, onChange }: Props) {
  const content = block.content as WritingContent

  const update = (partial: Partial<WritingContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  return (
    <div className="space-y-4">
      <TitleField block={block} onChange={onChange} placeholder="e.g. Writing: Formal Email" />

      <div>
        <FieldLabel>Writing prompt</FieldLabel>
        <TextArea
          value={content.prompt}
          onChange={(prompt) => update({ prompt })}
          placeholder="Describe what the student should write..."
        />
      </div>

      <div>
        <FieldLabel>Guidelines</FieldLabel>
        <TextArea
          value={content.guidelines}
          onChange={(guidelines) => update({ guidelines })}
          placeholder="e.g. Use formal language, include a greeting and sign-off..."
          heightClass="h-20"
        />
      </div>

      <div>
        <FieldLabel>Word limit</FieldLabel>
        <TextInput
          type="number"
          value={content.word_limit}
          onChange={(v) => update({ word_limit: parseInt(v) || 0 })}
          className="w-32"
        />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PronunciationEditor (legacy renderPronunciationEditor, page.tsx 3590-3655)
//   content: { words: PronunciationWord[] }
// ════════════════════════════════════════════════════════════════

export function PronunciationEditor({ block, onChange }: Props) {
  const content = block.content as PronunciationContent
  const words = content.words || []

  const updateWords = (newWords: PronunciationWord[]) => {
    onChange({ ...block, content: { words: newWords } })
  }

  const updateWord = (wIdx: number, field: keyof PronunciationWord, value: string) => {
    const updated = [...words]
    updated[wIdx] = { ...updated[wIdx], [field]: value }
    updateWords(updated)
  }

  const addWord = () => {
    updateWords([...words, { word: '', phonetic: '', tips: '' }])
  }

  const removeWord = (wIdx: number) => {
    updateWords(words.filter((_, i) => i !== wIdx))
  }

  return (
    <div className="space-y-4">
      <TitleField block={block} onChange={onChange} placeholder="e.g. Pronunciation Practice" />

      {words.map((w, wIdx) => (
        <RepeaterCard key={wIdx} label={`#${wIdx + 1}`} onRemove={() => removeWord(wIdx)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel>Word</FieldLabel>
              <TextInput
                value={w.word}
                onChange={(v) => updateWord(wIdx, 'word', v)}
                className="w-full"
              />
            </div>
            <div>
              <FieldLabel>Phonetic</FieldLabel>
              <TextInput
                value={w.phonetic}
                onChange={(v) => updateWord(wIdx, 'phonetic', v)}
                placeholder="/.../"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Tips</FieldLabel>
            <TextInput
              value={w.tips}
              onChange={(v) => updateWord(wIdx, 'tips', v)}
              placeholder="Pronunciation tips..."
              className="w-full"
            />
          </div>
        </RepeaterCard>
      ))}

      <AddRowButton label="+ Add Word" onClick={addWord} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MistakesEditor (legacy renderMistakesEditor, page.tsx 3036-3148)
//   content: { mistakes: Mistake[] } where each mistake has a practice[]
//   sub-repeater of MCQ-shaped questions.
// ════════════════════════════════════════════════════════════════

export function MistakesEditor({ block, onChange }: Props) {
  const content = block.content as MistakesContent
  const mistakes = content.mistakes || []

  const updateBlock = (newContent: MistakesContent) => {
    onChange({ ...block, content: newContent })
  }

  const updateMistake = (mIdx: number, field: keyof Mistake, value: string) => {
    const updated = [...mistakes]
    updated[mIdx] = { ...updated[mIdx], [field]: value }
    updateBlock({ mistakes: updated })
  }

  const addMistake = () => {
    updateBlock({
      mistakes: [...mistakes, { original: '', correction: '', explanation: '', practice: [] }],
    })
  }

  const removeMistake = (mIdx: number) => {
    updateBlock({ mistakes: mistakes.filter((_, i) => i !== mIdx) })
  }

  const addPractice = (mIdx: number) => {
    const updated = [...mistakes]
    updated[mIdx] = {
      ...updated[mIdx],
      practice: [...updated[mIdx].practice, { prompt: '', options: ['', ''], correctIndex: -1 }],
    }
    updateBlock({ mistakes: updated })
  }

  const updatePractice = (
    mIdx: number,
    pIdx: number,
    field: keyof MistakePractice,
    value: string | number | string[],
  ) => {
    const updated = [...mistakes]
    const practice = [...updated[mIdx].practice]
    practice[pIdx] = { ...practice[pIdx], [field]: value }
    updated[mIdx] = { ...updated[mIdx], practice }
    updateBlock({ mistakes: updated })
  }

  const removePractice = (mIdx: number, pIdx: number) => {
    const updated = [...mistakes]
    updated[mIdx] = {
      ...updated[mIdx],
      practice: updated[mIdx].practice.filter((_, i) => i !== pIdx),
    }
    updateBlock({ mistakes: updated })
  }

  return (
    <div className="space-y-4">
      <TitleField
        block={block}
        onChange={onChange}
        placeholder="e.g. Common Mistakes from Today's Class"
      />

      {mistakes.map((m, mIdx) => (
        <RepeaterCard
          key={mIdx}
          label={`Mistake #${mIdx + 1}`}
          onRemove={() => removeMistake(mIdx)}
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel>Original (wrong)</FieldLabel>
              <TextInput
                value={m.original}
                onChange={(v) => updateMistake(mIdx, 'original', v)}
                placeholder="e.g. I didn't went"
                className="w-full"
              />
            </div>
            <div>
              <FieldLabel>Correction</FieldLabel>
              <TextInput
                value={m.correction}
                onChange={(v) => updateMistake(mIdx, 'correction', v)}
                placeholder="e.g. I didn't go"
                className="w-full"
              />
            </div>
          </div>

          <div className="mb-3">
            <FieldLabel>Explanation</FieldLabel>
            <TextArea
              value={m.explanation}
              onChange={(v) => updateMistake(mIdx, 'explanation', v)}
              placeholder="Explain why this is wrong..."
              heightClass="h-16"
            />
          </div>

          {/* Practice Questions sub-repeater */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
              Practice Questions ({m.practice.length})
            </span>
            <Button variant="textLink" size="sm" onClick={() => addPractice(mIdx)}>
              + Add Practice
            </Button>
          </div>

          {m.practice.map((p, pIdx) => (
            <div key={pIdx} className="bg-white rounded-tile p-3 border border-hairline mb-2">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  Practice {pIdx + 1}
                </span>
                <Button
                  variant="textLink"
                  size="sm"
                  onClick={() => removePractice(mIdx, pIdx)}
                  className="!text-incorrect-fg"
                >
                  Remove
                </Button>
              </div>
              <div className="mb-2">
                <TextInput
                  value={p.prompt}
                  onChange={(v) => updatePractice(mIdx, pIdx, 'prompt', v)}
                  placeholder="Question prompt..."
                  className="w-full"
                />
              </div>
              <McqOptionsList
                options={p.options}
                correctIndex={p.correctIndex}
                radioName={'mp-' + mIdx + '-' + pIdx}
                onChange={({ options, correctIndex }) => {
                  updatePractice(mIdx, pIdx, 'options', options)
                  updatePractice(mIdx, pIdx, 'correctIndex', correctIndex)
                }}
              />
            </div>
          ))}
        </RepeaterCard>
      ))}

      <AddRowButton label="+ Add Mistake" onClick={addMistake} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// DialogueEditor (legacy renderDialogueEditor, page.tsx 3308-3364)
//   content: { scenario, target_words, starter_message }
//   target_words is bound to a single comma-separated input + chip preview.
//   The "View student chats" button is DEFERRED (not rendered).
// ════════════════════════════════════════════════════════════════

export function DialogueEditor({ block, onChange }: Props) {
  const content = block.content as DialogueContent
  const targetWords = content.target_words || []

  const update = (partial: Partial<DialogueContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  return (
    <div className="space-y-4">
      <TitleField block={block} onChange={onChange} placeholder="e.g. Practice: At the Restaurant" />

      <div>
        <FieldLabel>Scenario description</FieldLabel>
        <TextArea
          value={content.scenario}
          onChange={(scenario) => update({ scenario })}
          placeholder="Describe the conversation scenario... e.g. You're at a restaurant ordering food for a dinner party."
        />
      </div>

      <div>
        <FieldLabel>Target words (comma-separated)</FieldLabel>
        <TextInput
          value={targetWords.join(', ')}
          onChange={(v) =>
            update({
              target_words: v
                .split(',')
                .map((w) => w.trim())
                .filter(Boolean),
            })
          }
          placeholder="appetizer, reservation, bill, tip"
          className="w-full"
        />
        {targetWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {targetWords.map((w, i) => (
              <Pill key={i} variant="wash">
                {w}
              </Pill>
            ))}
          </div>
        )}
      </div>

      <div>
        <FieldLabel>AI starter message</FieldLabel>
        <TextArea
          value={content.starter_message}
          onChange={(starter_message) => update({ starter_message })}
          placeholder="The first message the AI will say... e.g. Welcome! Have you been here before?"
          heightClass="h-20"
        />
      </div>
    </div>
  )
}
