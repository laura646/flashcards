import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// ── SM-2 (SuperMemo 2) ──
// 4 grade buttons map to SM-2 quality scores:
//   Again = 1 (failed)  ·  Hard = 3  ·  Good = 4  ·  Easy = 5
const GRADE_QUALITY: Record<string, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

// Max brand-new words (never reviewed) to surface per fetch, so a big
// freshly-synced backlog doesn't overwhelm the student in one sitting.
const NEW_WORDS_PER_FETCH = 15

interface Sm2State {
  ease_factor: number
  interval_days: number
  repetitions: number
}

// Run one SM-2 step. Returns the new memory state + next review date.
function sm2(prev: Sm2State, quality: number): Sm2State & { next_review_at: string; box_level: number } {
  let ease = prev.ease_factor || DEFAULT_EASE
  let reps = prev.repetitions || 0
  let interval = prev.interval_days || 0

  if (quality < 3) {
    // Failed recall — reset the streak, see it again tomorrow
    reps = 0
    interval = 1
  } else {
    if (reps === 0) interval = 1
    else if (reps === 1) interval = 6
    else interval = Math.round(interval * ease)
    reps += 1
  }

  // Update the ease factor (standard SM-2 formula), clamped to a floor
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease < MIN_EASE) ease = MIN_EASE

  const next = new Date(Date.now() + interval * 24 * 60 * 60 * 1000)

  return {
    ease_factor: ease,
    interval_days: interval,
    repetitions: reps,
    next_review_at: next.toISOString(),
    box_level: boxFromInterval(interval),
  }
}

// The existing stats bar chart is built around 5 "boxes". With SM-2 we
// no longer have boxes — so derive a 1–5 mastery stage from the interval
// to keep that visualisation working without a rewrite.
//   <1d New · <7d Learning · <21d Familiar · <60d Known · ≥60d Mastered
function boxFromInterval(intervalDays: number): number {
  if (intervalDays < 1) return 1
  if (intervalDays < 7) return 2
  if (intervalDays < 21) return 3
  if (intervalDays < 60) return 4
  return 5
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email
  const action = req.nextUrl.searchParams.get('action')

  try {
    if (action === 'due') {
      const nowIso = new Date().toISOString()

      // 1. In-progress reviews that are due (already seen at least once).
      //    These take priority — keeping known words fresh matters most.
      const { data: reviewDue, error: rErr } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('user_email', email)
        .gt('repetitions', 0)
        .lte('next_review_at', nowIso)
        .order('next_review_at', { ascending: true })
        .limit(50)
      if (rErr) throw rErr

      // 2. Brand-new words (never reviewed), throttled so a freshly
      //    synced backlog doesn't dump hundreds at once.
      const { data: newWords, error: nErr } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('user_email', email)
        .eq('repetitions', 0)
        .lte('next_review_at', nowIso)
        .order('next_review_at', { ascending: true })
        .limit(NEW_WORDS_PER_FETCH)
      if (nErr) throw nErr

      // Reviews first, then a capped trickle of new words
      const words = [...(reviewDue || []), ...(newWords || [])]
      return NextResponse.json({ words })
    }

    if (action === 'stats') {
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('box_level, repetitions, next_review_at')
        .eq('user_email', email)

      if (error) throw error

      const nowIso = new Date().toISOString()
      const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0, due: 0, review_due: 0, new_words: 0 }
      ;(data || []).forEach((w: { box_level: number; repetitions: number; next_review_at: string }) => {
        stats[w.box_level as keyof typeof stats] = ((stats[w.box_level as keyof typeof stats] as number) || 0) + 1
        stats.total++
        if (w.next_review_at <= nowIso) {
          if (w.repetitions > 0) {
            stats.review_due++
          } else {
            stats.new_words++
          }
          stats.due++
        }
      })

      return NextResponse.json({ stats })
    }

    if (action === 'streak') {
      // Consecutive-day review streak, computed from vocab_review rows
      // logged to the progress table when a trainer session completes.
      const { data: rows } = await supabase
        .from('progress')
        .select('completed_at')
        .eq('user_email', email)
        .eq('activity_type', 'vocab_review')
        .order('completed_at', { ascending: false })
        .limit(400)

      const dayKeys = new Set(
        (rows || []).map((r: { completed_at: string }) => {
          const d = new Date(r.completed_at)
          return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
        })
      )

      const keyFor = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
      const today = new Date()
      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)

      let streak = 0
      if (dayKeys.has(keyFor(today)) || dayKeys.has(keyFor(yesterday))) {
        const cursor = new Date()
        if (!dayKeys.has(keyFor(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1)
        while (dayKeys.has(keyFor(cursor))) {
          streak += 1
          cursor.setUTCDate(cursor.getUTCDate() - 1)
        }
      }
      return NextResponse.json({ streak, reviewedToday: dayKeys.has(keyFor(today)) })
    }

    if (action === 'focus') {
      // "Leech" proxy: SM-2 drives the ease factor down toward the 1.3
      // floor for words a student keeps failing. Low ease = needs extra
      // attention. We surface the hardest ones.
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('id, word, meaning, phonetic, ease_factor, box_level')
        .eq('user_email', email)
        .lte('ease_factor', 1.8)
        .gt('repetitions', 0)
        .order('ease_factor', { ascending: true })
        .limit(50)
      if (error) throw error
      return NextResponse.json({ words: data || [] })
    }

    if (action === 'easy') {
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('user_email', email)
        .gte('ease_factor', 2.5)
        .gte('repetitions', 1)
        .order('ease_factor', { ascending: false })
        .limit(50)
      if (error) throw error
      return NextResponse.json({ words: data || [] })
    }

    if (action === 'all') {
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('user_email', email)
        .order('box_level', { ascending: true })

      if (error) throw error
      return NextResponse.json({ words: data || [] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Vocab SRS GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email

  try {
    const body = await req.json()
    const { action } = body

    // Sync: import flashcards + word_struggles into SRS
    if (action === 'sync') {
      const courseId = body.course_id

      // Get all flashcards the student has access to
      let flashcardQuery = supabase
        .from('lesson_flashcards')
        .select('word, phonetic, meaning, example, image_url, lessons!inner(status, course_id)')
        .eq('lessons.status', 'published')

      if (courseId) {
        flashcardQuery = flashcardQuery.eq('lessons.course_id', courseId)
      }

      const { data: flashcards } = await flashcardQuery

      // Get word struggles
      const { data: struggles } = await supabase
        .from('word_struggles')
        .select('word')
        .eq('user_email', email)
        .eq('knew', false)

      // Get existing SRS words. We dedup against BOTH the (possibly
      // student-edited) word AND the original source_word, so a student
      // fixing a word's spelling never causes the next sync to re-add
      // the old spelling as a duplicate.
      const { data: existing } = await supabase
        .from('vocab_srs')
        .select('word, source_word')
        .eq('user_email', email)

      const existingWords = new Set<string>()
      ;(existing || []).forEach((w: { word: string; source_word: string | null }) => {
        if (w.word) existingWords.add(w.word.toLowerCase())
        if (w.source_word) existingWords.add(w.source_word.toLowerCase())
      })

      // Build a lookup of flashcard metadata by lowercased word so we can
      // ENRICH struggled words instead of inserting blank meanings.
      const fcByWord = new Map<string, { word: string; phonetic: string; meaning: string; example: string; image_url?: string | null }>()
      ;(flashcards || []).forEach((fc: { word: string; phonetic: string; meaning: string; example: string; image_url?: string | null }) => {
        const key = fc.word.toLowerCase()
        if (!fcByWord.has(key)) fcByWord.set(key, fc)
      })

      // Build new words to insert
      const newWords: { user_email: string; word: string; source_word: string; meaning: string; phonetic: string; example: string; image_url: string | null; box_level: number; next_review_at: string }[] = []

      // From flashcards
      ;(flashcards || []).forEach((fc: { word: string; phonetic: string; meaning: string; example: string; image_url?: string | null }) => {
        if (!existingWords.has(fc.word.toLowerCase())) {
          existingWords.add(fc.word.toLowerCase())
          newWords.push({
            user_email: email,
            word: fc.word,
            source_word: fc.word, // remember the original spelling for dedup
            meaning: fc.meaning || '',
            phonetic: fc.phonetic || '',
            example: fc.example || '',
            image_url: fc.image_url || null,
            box_level: 1,
            next_review_at: new Date().toISOString(),
          })
        }
      })

      // From word struggles (words the student got wrong). Enrich from the
      // matching flashcard if we have one — never insert blank metadata,
      // because a card with no meaning is useless in flip/quiz review.
      ;(struggles || []).forEach((s: { word: string }) => {
        const key = s.word.toLowerCase()
        if (!existingWords.has(key)) {
          existingWords.add(key)
          const match = fcByWord.get(key)
          newWords.push({
            user_email: email,
            word: s.word,
            source_word: s.word, // remember the original spelling for dedup
            meaning: match?.meaning || '',
            phonetic: match?.phonetic || '',
            example: match?.example || '',
            image_url: match?.image_url || null,
            box_level: 1,
            next_review_at: new Date().toISOString(),
          })
        }
      })

      if (newWords.length > 0) {
        const { error } = await supabase.from('vocab_srs').insert(newWords)
        if (error) throw error
      }

      return NextResponse.json({ ok: true, added: newWords.length })
    }

    // Review: run one SM-2 step from the student's grade.
    // Accepts the new graded API { word_id, grade: again|hard|good|easy }
    // and stays backward-compatible with the old { word_id, correct }.
    if (action === 'review') {
      const { word_id, grade, correct } = body

      if (!word_id) {
        return NextResponse.json({ error: 'Missing word_id' }, { status: 400 })
      }

      // Resolve the SM-2 quality score
      let quality: number
      if (typeof grade === 'string' && grade in GRADE_QUALITY) {
        quality = GRADE_QUALITY[grade]
      } else if (correct !== undefined) {
        // Legacy binary path: knew it → Good, didn't → Again
        quality = correct ? GRADE_QUALITY.good : GRADE_QUALITY.again
      } else {
        return NextResponse.json({ error: 'Missing grade or correct' }, { status: 400 })
      }

      const { data: word } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('id', word_id)
        .eq('user_email', email)
        .single()

      if (!word) {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 })
      }

      const next = sm2(
        {
          ease_factor: word.ease_factor ?? DEFAULT_EASE,
          interval_days: word.interval_days ?? 0,
          repetitions: word.repetitions ?? 0,
        },
        quality
      )

      const { error } = await supabase
        .from('vocab_srs')
        .update({
          ease_factor: next.ease_factor,
          interval_days: next.interval_days,
          repetitions: next.repetitions,
          box_level: next.box_level,
          next_review_at: next.next_review_at,
        })
        .eq('id', word_id)
        .eq('user_email', email)

      if (error) throw error
      return NextResponse.json({
        ok: true,
        new_box: next.box_level,
        interval_days: next.interval_days,
        next_review_at: next.next_review_at,
      })
    }

    // Add a single word manually
    if (action === 'add') {
      const { word, meaning, phonetic, example, translation } = body
      if (!word) {
        return NextResponse.json({ error: 'Missing word' }, { status: 400 })
      }

      const { error } = await supabase.from('vocab_srs').upsert({
        user_email: email,
        word,
        source_word: word,
        meaning: meaning || '',
        phonetic: phonetic || '',
        example: example || '',
        translation: translation || null,
        box_level: 1,
        next_review_at: new Date().toISOString(),
      }, { onConflict: 'user_email,word' })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // Student edits their OWN word. vocab_srs is per-user so this is
    // private by construction — the .eq('user_email', email) guard
    // means a student can only ever touch their own rows. source_word
    // is intentionally NOT changed here, so sync keeps deduping against
    // the original spelling even after the student fixes the word.
    if (action === 'update') {
      const { word_id, word, meaning, phonetic, example, notes, translation, image_url } = body
      if (!word_id) {
        return NextResponse.json({ error: 'Missing word_id' }, { status: 400 })
      }
      if (typeof word === 'string' && !word.trim()) {
        return NextResponse.json({ error: 'Word cannot be empty' }, { status: 400 })
      }

      // Build a patch only from fields that were actually provided
      const patch: Record<string, string | null> = {}
      if (typeof word === 'string') patch.word = word.trim()
      if (typeof meaning === 'string') patch.meaning = meaning
      if (typeof phonetic === 'string') patch.phonetic = phonetic
      if (typeof example === 'string') patch.example = example
      if (typeof notes === 'string') patch.notes = notes
      if (translation !== undefined) patch.translation = translation || null
      if (image_url !== undefined) patch.image_url = image_url || null

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
      }

      const { error } = await supabase
        .from('vocab_srs')
        .update(patch)
        .eq('id', word_id)
        .eq('user_email', email)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Vocab SRS POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
