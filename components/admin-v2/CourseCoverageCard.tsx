'use client'

// Course coverage — the rail card + full-size rich-text editor (prototype
// "card + full-page editor", approved 27 Aug). One living document per course:
// what was covered, challenges, plans. Feeds the printed course report (cover
// page, after the overview, before per-learner pages) and is read-only for HR.
//
// Rich text is sanitized with the same allowlist as reading passages, BOTH
// before saving and before every render.

import { useRef, useState } from 'react'
import { sanitizeRichText } from '@/lib/html'

function fmtWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function CourseCoverageCard({ html, updatedAt, updatedBy, canEdit, onSave }: {
  html: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  canEdit: boolean
  onSave: (html: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

  const clean = html ? sanitizeRichText(html) : ''

  const exec = (cmd: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const raw = editorRef.current?.innerHTML || ''
    const res = await onSave(sanitizeRichText(raw))
    setSaving(false)
    if (res.ok) setEditing(false)
    else setError(res.error || 'Could not save.')
  }

  return (
    <>
      <div className="bg-white rounded-card border border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-ink-black">📝 Course coverage</h3>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-bold text-sky-text hover:underline"
            >
              {clean ? 'Edit' : '+ Write'}
            </button>
          )}
        </div>
        {clean ? (
          <>
            <div
              className="text-[12.5px] text-ink-body leading-relaxed max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_75%,transparent)] prose-sm"
              dangerouslySetInnerHTML={{ __html: clean }}
            />
            <p className="text-[10.5px] text-ink-muted mt-2">
              updated {fmtWhen(updatedAt)}{updatedBy ? ` · ${updatedBy.split('@')[0]}` : ''} · appears in the course report
            </p>
          </>
        ) : (
          <p className="text-[12px] text-ink-muted italic">
            What has the course covered so far? Challenges, plans… This text goes into the course report.
          </p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div
            className="bg-white rounded-card border border-hairline w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="Edit course coverage"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h3 className="text-sm font-bold text-ink-black">Course coverage</h3>
              <button onClick={() => setEditing(false)} className="text-ink-muted hover:text-ink-black" aria-label="Close">✕</button>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 border-b border-hairline">
              {([['bold', 'B', 'font-extrabold'], ['italic', 'I', 'italic font-bold'], ['underline', 'U', 'underline font-bold']] as const).map(([cmd, label, cls]) => (
                <button
                  key={cmd}
                  onMouseDown={(e) => { e.preventDefault(); exec(cmd) }}
                  className={`w-8 h-8 rounded-lg border border-hairline text-[13px] text-ink-body hover:bg-surface ${cls}`}
                  title={cmd}
                >
                  {label}
                </button>
              ))}
              <button
                onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }}
                className="w-8 h-8 rounded-lg border border-hairline text-[13px] text-ink-body hover:bg-surface font-bold"
                title="Bullet list"
              >
                ••
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList') }}
                className="w-8 h-8 rounded-lg border border-hairline text-[13px] text-ink-body hover:bg-surface font-bold"
                title="Numbered list"
              >
                1.
              </button>
              <span className="flex-1" />
              <span className="text-[11px] text-ink-muted">shown in the course report</span>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="flex-1 overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-ink-body focus:outline-none min-h-[260px]"
              dangerouslySetInnerHTML={{ __html: clean || '<p></p>' }}
            />
            {error && <p className="px-4 pb-1 text-xs text-red-600">{error}</p>}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-hairline">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="text-xs font-bold px-4 py-2 rounded-lg border border-hairline text-ink-body hover:bg-surface disabled:opacity-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="text-xs font-extrabold px-4 py-2 rounded-lg bg-sky text-white hover:brightness-95 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
