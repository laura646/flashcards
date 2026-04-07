import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Leitner intervals in hours
const BOX_INTERVALS: Record<number, number> = {
  1: 0,      // Box 1: review every session (immediate)
  2: 48,     // Box 2: 2 days
  3: 96,     // Box 3: 4 days
  4: 192,    // Box 4: 8 days
  5: 336,    // Box 5: 14 days (mastered)
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
      // Get words due for review (next_review_at <= now)
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('user_email', email)
        .lte('next_review_at', new Date().toISOString())
        .order('box_level', { ascending: true })
        .order('next_review_at', { ascending: true })
        .limit(20)

      if (error) throw error
      return NextResponse.json({ words: data || [] })
    }

    if (action === 'stats') {
      // Get box distribution
      const { data, error } = await supabase
        .from('vocab_srs')
        .select('box_level')
        .eq('user_email', email)

      if (error) throw error

      const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0, due: 0 }
      ;(data || []).forEach((w: { box_level: number }) => {
        stats[w.box_level as keyof typeof stats] = ((stats[w.box_level as keyof typeof stats] as number) || 0) + 1
        stats.total++
      })

      // Count due words
      const { count } = await supabase
        .from('vocab_srs')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .lte('next_review_at', new Date().toISOString())

      stats.due = count || 0
      return NextResponse.json({ stats })
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
        .select('word, phonetic, meaning, example, lessons!inner(status, course_id)')
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

      // Get existing SRS words
      const { data: existing } = await supabase
        .from('vocab_srs')
        .select('word')
        .eq('user_email', email)

      const existingWords = new Set((existing || []).map((w: { word: string }) => w.word.toLowerCase()))

      // Build new words to insert
      const newWords: { user_email: string; word: string; meaning: string; phonetic: string; example: string; box_level: number; next_review_at: string }[] = []

      // From flashcards
      ;(flashcards || []).forEach((fc: { word: string; phonetic: string; meaning: string; example: string }) => {
        if (!existingWords.has(fc.word.toLowerCase())) {
          existingWords.add(fc.word.toLowerCase())
          newWords.push({
            user_email: email,
            word: fc.word,
            meaning: fc.meaning || '',
            phonetic: fc.phonetic || '',
            example: fc.example || '',
            box_level: 1,
            next_review_at: new Date().toISOString(),
          })
        }
      })

      // From word struggles (words the student got wrong)
      ;(struggles || []).forEach((s: { word: string }) => {
        if (!existingWords.has(s.word.toLowerCase())) {
          existingWords.add(s.word.toLowerCase())
          newWords.push({
            user_email: email,
            word: s.word,
            meaning: '',
            phonetic: '',
            example: '',
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

    // Review: update a word's box level based on correct/incorrect
    if (action === 'review') {
      const { word_id, correct } = body

      if (!word_id || correct === undefined) {
        return NextResponse.json({ error: 'Missing word_id or correct' }, { status: 400 })
      }

      // Get current word
      const { data: word } = await supabase
        .from('vocab_srs')
        .select('*')
        .eq('id', word_id)
        .eq('user_email', email)
        .single()

      if (!word) {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 })
      }

      let newBox: number
      if (correct) {
        // Move up one box (max 5)
        newBox = Math.min(word.box_level + 1, 5)
      } else {
        // Back to box 1
        newBox = 1
      }

      const intervalHours = BOX_INTERVALS[newBox] || 0
      const nextReview = new Date(Date.now() + intervalHours * 60 * 60 * 1000)

      const { error } = await supabase
        .from('vocab_srs')
        .update({
          box_level: newBox,
          next_review_at: nextReview.toISOString(),
        })
        .eq('id', word_id)
        .eq('user_email', email)

      if (error) throw error
      return NextResponse.json({ ok: true, new_box: newBox, next_review_at: nextReview.toISOString() })
    }

    // Add a single word manually
    if (action === 'add') {
      const { word, meaning, phonetic, example } = body
      if (!word) {
        return NextResponse.json({ error: 'Missing word' }, { status: 400 })
      }

      const { error } = await supabase.from('vocab_srs').upsert({
        user_email: email,
        word,
        meaning: meaning || '',
        phonetic: phonetic || '',
        example: example || '',
        box_level: 1,
        next_review_at: new Date().toISOString(),
      }, { onConflict: 'user_email,word' })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Vocab SRS POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
