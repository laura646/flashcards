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
