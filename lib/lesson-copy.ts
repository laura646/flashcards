// Field-COMPLETE deep copy of a lesson (row + flashcards + exercises +
// blocks) into a target course. One implementation shared by the
// content-bank clone-lesson action and Course Pack import, replacing the
// old inline clone that silently dropped fields (test settings, flashcard
// images, exercise points/skills/mandatory flags, published states) —
// per the rule: a copied test arrives complete, teacher edits their copy.

import { supabase } from '@/lib/supabase'

export interface DeepCopyOpts {
  courseId: string
  status: 'draft' | 'published'
  lessonDate: string
  publishAt?: string | null
  createdBy?: string | null
  // Course Pack provenance (best-effort columns; see migration-course-packs.sql)
  syllabusOrder?: number | null
  sourcePackId?: string | null
}

export async function deepCopyLesson(
  templateId: string,
  opts: DeepCopyOpts
): Promise<{ lessonId: string }> {
  const [lessonRes, fcRes, exRes, blockRes] = await Promise.all([
    supabase.from('lessons').select('*').eq('id', templateId).single(),
    supabase.from('lesson_flashcards').select('*').eq('lesson_id', templateId).order('order_index'),
    supabase.from('lesson_exercises').select('*').eq('lesson_id', templateId).order('order_index'),
    supabase.from('lesson_blocks').select('*').eq('lesson_id', templateId).order('order_index'),
  ])
  if (lessonRes.error || !lessonRes.data) throw new Error('Template not found')
  const t = lessonRes.data as Record<string, unknown>

  const { data: newLesson, error: insertErr } = await supabase
    .from('lessons')
    .insert({
      title: t.title,
      lesson_date: opts.lessonDate,
      lesson_type: (t.lesson_type as string) || 'lesson',
      summary: t.summary ?? null,
      status: opts.status,
      course_id: opts.courseId,
      publish_at: opts.publishAt ?? null,
      created_by: opts.createdBy ?? null,
      flashcards_published: t.flashcards_published !== false,
    })
    .select('id')
    .single()
  if (insertErr) throw insertErr
  const newId = (newLesson as { id: string }).id

  // Newer lesson columns (exam settings, pack provenance) go in a separate
  // best-effort update so a not-yet-migrated DB never breaks the copy —
  // same fail-open pattern as the lesson editor's test-settings save.
  const extra: Record<string, unknown> = {}
  if (typeof t.time_limit_minutes === 'number') extra.time_limit_minutes = t.time_limit_minutes
  if (typeof t.test_reveal_answers === 'boolean') extra.test_reveal_answers = t.test_reveal_answers
  if (t.test_rules_lang === 'hy' || t.test_rules_lang === 'en') extra.test_rules_lang = t.test_rules_lang
  if (typeof opts.syllabusOrder === 'number') extra.syllabus_order = opts.syllabusOrder
  if (opts.sourcePackId) extra.source_pack_id = opts.sourcePackId
  if (Object.keys(extra).length > 0) {
    const { error: extraErr } = await supabase.from('lessons').update(extra).eq('id', newId)
    if (extraErr) console.error('deepCopyLesson: extra columns not copied (migration pending?):', extraErr.message)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const flashcards = (fcRes.data || []) as any[]
  if (flashcards.length > 0) {
    const rows = flashcards.map((fc) => ({
      lesson_id: newId,
      word: fc.word,
      phonetic: fc.phonetic,
      meaning: fc.meaning,
      example: fc.example,
      notes: fc.notes,
      image_url: fc.image_url ?? null,
      order_index: fc.order_index,
    }))
    const { error } = await supabase.from('lesson_flashcards').insert(rows)
    if (error) throw error
  }

  const exercises = (exRes.data || []) as any[]
  if (exercises.length > 0) {
    const rows = exercises.map((ex) => ({
      lesson_id: newId,
      title: ex.title,
      subtitle: ex.subtitle,
      icon: ex.icon,
      instructions: ex.instructions,
      exercise_type: ex.exercise_type,
      questions: ex.questions,
      order_index: ex.order_index,
      points_per_answer: ex.points_per_answer ?? null,
      completion_bonus: ex.completion_bonus ?? null,
      is_mandatory: ex.is_mandatory ?? null,
      skills: ex.skills ?? null,
      cefr_level: ex.cefr_level ?? null,
      test_type: ex.test_type ?? null,
      published: ex.published !== false,
    }))
    const { error } = await supabase.from('lesson_exercises').insert(rows)
    if (error) throw error
  }

  const blocks = (blockRes.data || []) as any[]
  if (blocks.length > 0) {
    const rows = blocks.map((b) => ({
      lesson_id: newId,
      block_type: b.block_type,
      title: b.title,
      content: b.content,
      order_index: b.order_index,
      published: b.published !== false,
    }))
    const { error } = await supabase.from('lesson_blocks').insert(rows)
    if (error) throw error
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { lessonId: newId }
}
