'use client'

// Wave 0 verification harness for answer-check + AnswerMark. Not linked;
// delete with the other preview routes on sign-off.

import { checkGapAnswer, countWords, gapFeedback } from '@/lib/answer-check'
import AnswerMark from '@/components/student-ui/AnswerMark'

const cases = [
  { name: 'exact', r: checkGapAnswer('cancel', ['cancel', 'cancelled'], 2), want: true },
  { name: 'variant + case/space', r: checkGapAnswer('  Cancelled ', ['cancel', 'cancelled'], 2), want: true },
  { name: 'over word limit', r: checkGapAnswer('the contract terms', ['contract'], 2), want: false, reason: 'over_word_limit' },
  { name: 'mismatch', r: checkGapAnswer('agreement', ['contract'], 2), want: false, reason: 'mismatch' },
  { name: 'empty', r: checkGapAnswer('', ['contract'], 2), want: false, reason: 'empty' },
]
const wordCounts = [countWords('well-known') === 1, countWords('20 minutes') === 2, countWords("don't go") === 2]
const allPass = cases.every((c) => c.r.correct === c.want && (!c.reason || c.r.reason === c.reason)) && wordCounts.every(Boolean)

export default function AnswersPreview() {
  return (
    <main className="min-h-screen bg-surface font-rubik px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-card border border-hairline p-5">
        <h2 className="text-sm font-extrabold text-brandblue mb-4">Answer-check + AnswerMark</h2>

        <p data-testid="verdict" className="text-xs font-bold mb-4">{allPass ? 'ALL_PASS' : 'SOME_FAIL'}</p>

        <div className="space-y-2 mb-6">
          {cases.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-ink-muted">{c.name}</span>
              <AnswerMark correct={c.r.correct} detail={gapFeedback(c.r, 2)} />
            </div>
          ))}
        </div>

        <p className="text-[11px] text-ink-muted">word counts ok: {String(wordCounts.every(Boolean))}</p>
      </div>
    </main>
  )
}
