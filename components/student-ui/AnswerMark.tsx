'use client'

// Wave 0 — accessible right/wrong mark.
//
// UX-pass fix: answer-checking must NOT signal correct/incorrect by colour
// alone. This pairs a tick/cross ICON + a WORD ("Correct"/"Incorrect") + a
// screen-reader announcement, on the accessible correct/incorrect tokens.
// `detail` carries the "why" (e.g. "Over the 2-word limit", "Expected:
// cancelled") from gapFeedback(). Reused by every IELTS answer check + the
// teacher review screen.

export function AnswerMark({ correct, detail, className = '' }: { correct: boolean; detail?: string; className?: string }) {
  const tone = correct ? 'text-correct-fg' : 'text-incorrect-fg'
  const chip = correct ? 'bg-correct-fg' : 'bg-incorrect-fg'
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold ${chip}`}>
        {correct ? '✓' : '✗'}
      </span>
      <span className={`text-[12px] font-bold ${tone}`}>
        <span className="sr-only">{correct ? 'Correct.' : 'Incorrect.'} </span>
        {correct ? 'Correct' : (detail || 'Incorrect')}
      </span>
    </span>
  )
}

export default AnswerMark
