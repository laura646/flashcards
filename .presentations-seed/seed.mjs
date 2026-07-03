// Seed a presentation deck into School Library → Presentations → Roadmap A1.
// Idempotent: safe to re-run (find-or-create for bucket object, folders, lesson,
// presentation block, and folder link). Reads ../.env.local for Supabase creds
// (prefers the service-role key so storage upload + inserts bypass RLS).
// Usage: node .presentations-seed/seed.mjs
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const env = readFileSync(path.join(HERE, '..', '.env.local'), 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const URL_ = get('NEXT_PUBLIC_SUPABASE_URL')
const KEY = get('SUPABASE_SERVICE_ROLE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (!URL_ || !KEY) throw new Error('Missing Supabase URL or key in .env.local')
const usingService = !!get('SUPABASE_SERVICE_ROLE_KEY')

const OWNER = 'laura@englishwithlaura.com'
const BUCKET = 'exercise-images'
const OBJECT_PATH = 'presentations/roadmap-a1/unit-5c-food-and-drink.html'
const DECK_FILE = '/Users/laurasamvelyan/Documents/Claude Folder/flashcards-app/HTML Files with Presentation Decks/Roadmap A1 Presntations HTML/Unit 5C Food and Drink - animated.html'
const DECK_URL = `${URL_}/storage/v1/object/public/${BUCKET}/${OBJECT_PATH}`
const LESSON_TITLE = 'Unit 5C — Food and drink'
const TODAY = '2026-07-04'

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(method, pathname, body, prefer) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    method,
    headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function uploadDeck() {
  const buf = readFileSync(DECK_FILE)
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'text/html', 'x-upsert': 'true' },
    body: buf,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`upload → ${res.status}: ${text.slice(0, 300)}`)
  console.log(`uploaded deck (${(buf.length / 1048576).toFixed(1)} MB) → ${DECK_URL}`)
}

async function findOrCreateFolder(name, parentId) {
  const parentFilter = parentId ? `parent_id=eq.${parentId}` : 'parent_id=is.null'
  const found = await api('GET', `content_bank_folders?select=id&name=eq.${encodeURIComponent(name)}&${parentFilter}`)
  if (found.length) { console.log(`folder exists: ${name} (${found[0].id})`); return found[0].id }
  const made = (await api('POST', 'content_bank_folders', { name, parent_id: parentId, created_by: OWNER }, 'return=representation'))[0]
  console.log(`folder created: ${name} (${made.id})`)
  return made.id
}

async function main() {
  console.log(`Supabase: ${URL_}  (auth: ${usingService ? 'service-role' : 'anon'})`)
  await uploadDeck()

  // Folder tree: Presentations (top-level) → Roadmap A1
  const presentationsId = await findOrCreateFolder('Presentations', null)
  const roadmapA1Id = await findOrCreateFolder('Roadmap A1', presentationsId)

  // Lesson row (shared library template) — idempotent by title.
  let lesson = (await api('GET', `lessons?select=id&title=eq.${encodeURIComponent(LESSON_TITLE)}&is_template=eq.true`))[0]
  if (!lesson) {
    lesson = (await api('POST', 'lessons', {
      title: LESSON_TITLE,
      summary: 'Animated class presentation (Claude Design) — full-screen slides with bundled audio. Present in class; share your screen on Zoom.',
      lesson_date: TODAY,
      status: 'published',
      lesson_type: 'lesson',
      is_template: true,
      is_shared: true,
      template_level: 'A1',
      course_id: null,
      created_by: OWNER,
    }, 'return=representation'))[0]
    console.log(`lesson created: ${lesson.id}`)
  } else console.log(`lesson exists: ${lesson.id}`)

  // Presentation block (holds the deck URL) — idempotent by block_type.
  const existingBlock = await api('GET', `lesson_blocks?select=id&lesson_id=eq.${lesson.id}&block_type=eq.presentation`)
  const blockContent = { deck_url: DECK_URL, source: 'claude-design', audio_bundled: true }
  if (!existingBlock.length) {
    await api('POST', 'lesson_blocks', {
      lesson_id: lesson.id,
      block_type: 'presentation',
      title: 'Presentation deck',
      order_index: 0,
      published: true,
      content: blockContent,
    })
    console.log('presentation block created')
  } else {
    await api('PATCH', `lesson_blocks?id=eq.${existingBlock[0].id}`, { content: blockContent })
    console.log('presentation block updated (deck_url refreshed)')
  }

  // File the lesson into Presentations → Roadmap A1 — idempotent.
  const link = await api('GET', `lesson_folders?select=lesson_id&lesson_id=eq.${lesson.id}&folder_id=eq.${roadmapA1Id}`)
  if (!link.length) {
    await api('POST', 'lesson_folders', { lesson_id: lesson.id, folder_id: roadmapA1Id })
    console.log('filed into Presentations → Roadmap A1')
  } else console.log('already filed into Roadmap A1')

  console.log('\nDONE. Present URL: /present/' + lesson.id)
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
