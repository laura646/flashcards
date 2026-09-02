// Single source of truth for Anthropic model selection.
//
// Tiered model policy (Phase R-4):
//   - SONNET_MODEL: creative + pedagogical work where quality matters
//     (Reading from-scratch generation, Grammar explanations + pitfalls,
//      dialogue chat, etc.).
//   - HAIKU_MODEL: templated / structured / exercise-gen tasks where
//     prompt-following matters more than original prose (flashcards from
//     summary, exercise generation from source, type conversion,
//     suggest-exercises-from-reading, generate-block, doc imports).
//
// Both are overridable via env vars so we can swap families without a
// code change.

export const SONNET_MODEL =
  process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6'

export const HAIKU_MODEL =
  process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5'

// ── Overload resilience ──
// 2 Sep 2026: claude-haiku-4-5 served sustained 529 overloaded_error while
// claude-sonnet-4-6 answered fine, and every teacher-facing AI action showed
// a bare "AI generation failed". One model having a bad hour must not take
// the feature down: retry once, then fall back to the sibling model.
// Structural type kept loose on purpose: the SDK's overloaded create()
// signatures don't unify with a generic param record.
type MessagesCreate = { create: (params: never) => unknown }

function isOverloaded(err: unknown): boolean {
  const e = err as { status?: number; error?: { error?: { type?: string } } }
  return e?.status === 529 || e?.status === 429 ||
    (e as { error?: { type?: string } })?.error?.type === 'overloaded_error' ||
    e?.error?.error?.type === 'overloaded_error'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Drop-in replacement for client.messages.create(params): one retry on the
// requested model, then one attempt on the fallback sibling (Haiku↔Sonnet).
export async function createWithFallback<T>(
  messages: MessagesCreate,
  params: Record<string, unknown> & { model: string }
): Promise<T> {
  try {
    return (await messages.create(params as never)) as T
  } catch (err) {
    if (!isOverloaded(err)) throw err
    await sleep(1500)
    try {
      return (await messages.create(params as never)) as T
    } catch (err2) {
      if (!isOverloaded(err2)) throw err2
      const fallback = params.model === HAIKU_MODEL ? SONNET_MODEL : HAIKU_MODEL
      console.error(`AI model ${params.model} overloaded twice — falling back to ${fallback}`)
      return (await messages.create({ ...params, model: fallback } as never)) as T
    }
  }
}
