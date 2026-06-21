'use client'

// IELTS Reading — TEACHER authoring editor: Table completion (Type 11).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingTableCompletionRunner consumes (see ReadingTableCompletionRunner.tsx):
//   wordLimit?  (group default)
//   header?: string[]                  (optional bold column-heading row)
//   rows: TableCell[][]                (body rows, each a left-to-right cell list)
//   TableCell = { type:'text', text }
//             | { type:'gap', number, acceptedAnswers, wordLimit? }
//
// The teacher edits a clean grid: set the column header row (add/remove
// columns), add/remove rows, and toggle each cell between free text and a gap
// (acceptedAnswers comma + optional word limit). Gap numbers are re-sequenced in
// row-major order (left→right, top→bottom) on every change, matching the order
// the runner walks the cells for scoring.

import type { TableCompletionGroup, TableCell } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type GapCell = Extract<TableCell, { type: 'gap' }>

export interface TableCompletionGroupEditorProps {
  group: TableCompletionGroup
  onChange: (group: TableCompletionGroup) => void
}

/** Re-sequence gap numbers 1, 2, 3 … in row-major order across the grid. */
function renumber(rows: TableCell[][]): TableCell[][] {
  let n = 0
  return rows.map((row) =>
    row.map((cell) =>
      cell.type === 'gap' ? { ...cell, number: ++n } : cell,
    ),
  )
}

export default function TableCompletionGroupEditor({
  group,
  onChange,
}: TableCompletionGroupEditorProps) {
  const rows = group.rows
  const header = group.header ?? []
  // The grid width: the widest of the header and any body row.
  const colCount = Math.max(
    header.length,
    rows.reduce((max, r) => Math.max(max, r.length), 0),
    1,
  )

  const setRows = (next: TableCell[][]) =>
    onChange({ ...group, rows: renumber(next) })

  const patchCell = (ri: number, ci: number, cell: TableCell) =>
    setRows(rows.map((row, r) => (r === ri ? row.map((c, ccc) => (ccc === ci ? cell : c)) : row)))

  const patchGap = (ri: number, ci: number, p: Partial<GapCell>) => {
    const cell = rows[ri]?.[ci]
    if (!cell || cell.type !== 'gap') return
    patchCell(ri, ci, { ...cell, ...p })
  }

  /** Pad a row to the current column count with empty text cells. */
  const padRow = (row: TableCell[]): TableCell[] => {
    const next = [...row]
    while (next.length < colCount) next.push({ type: 'text', text: '' })
    return next
  }

  // ── Columns ──
  const addColumn = () => {
    onChange({
      ...group,
      header: [...header, ''],
      rows: renumber(rows.map((row) => [...padRow(row), { type: 'text', text: '' }])),
    })
  }

  const removeColumn = (ci: number) => {
    const nextHeader = header.filter((_, i) => i !== ci)
    const nextRows = rows.map((row) => padRow(row).filter((_, i) => i !== ci))
    onChange({
      ...group,
      header: nextHeader.length > 0 ? nextHeader : undefined,
      rows: renumber(nextRows),
    })
  }

  const setHeaderText = (ci: number, text: string) => {
    const next = [...header]
    while (next.length < colCount) next.push('')
    next[ci] = text
    onChange({ ...group, header: next })
  }

  // ── Rows ──
  const addRow = () => {
    const blank: TableCell[] = Array.from({ length: colCount }, () => ({
      type: 'text',
      text: '',
    }))
    setRows([...rows, blank])
  }

  const removeRow = (ri: number) => setRows(rows.filter((_, i) => i !== ri))

  /** Toggle a cell between free text and a gap, preserving nothing across kinds. */
  const toggleCell = (ri: number, ci: number) => {
    const cell = rows[ri]?.[ci]
    if (!cell) return
    if (cell.type === 'text') {
      patchCell(ri, ci, { type: 'gap', number: 0, acceptedAnswers: [''] })
    } else {
      patchCell(ri, ci, { type: 'text', text: '' })
    }
  }

  const colIndexes = Array.from({ length: colCount }, (_, i) => i)

  return (
    <div className="flex flex-col gap-4">
      {/* Group word limit */}
      <label className="block w-44">
        <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
          Word limit (all gaps)
        </span>
        <input
          type="number"
          min={1}
          value={group.wordLimit ?? ''}
          placeholder="e.g. 2"
          onChange={(e) =>
            onChange({ ...group, wordLimit: parseWordLimit(e.target.value) })
          }
          className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
        />
      </label>

      {/* Column headers */}
      <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
            Column headers
          </span>
          <Button variant="neutral" size="sm" onClick={addColumn}>
            + Add column
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {colIndexes.map((ci) => (
            <div key={ci} className="flex items-center gap-2">
              <span className="shrink-0 inline-flex items-center justify-center min-w-[2.5rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
                Col {ci + 1}
              </span>
              <input
                type="text"
                value={header[ci] ?? ''}
                placeholder="Heading (optional)"
                onChange={(e) => setHeaderText(ci, e.target.value)}
                className="flex-1 text-[14px] font-extrabold text-ink-black bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
              <Button
                variant="textLink"
                size="sm"
                onClick={() => removeColumn(ci)}
                disabled={colCount <= 1}
                aria-label={`Remove column ${ci + 1}`}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Body rows */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Rows
        </span>
        {rows.map((row, ri) => {
          const cells = padRow(row)
          return (
            <div
              key={ri}
              className="rounded-tile border border-hairline bg-surface p-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  Row {ri + 1}
                </span>
                <Button
                  variant="textLink"
                  size="sm"
                  onClick={() => removeRow(ri)}
                  aria-label={`Delete row ${ri + 1}`}
                >
                  Delete row
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {cells.map((cell, ci) => (
                  <div
                    key={ci}
                    className="rounded-tile border border-hairline bg-white p-2.5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                        {header[ci] ? header[ci] : `Col ${ci + 1}`}
                        {cell.type === 'gap' ? ` · Gap Q${cell.number}` : ''}
                      </span>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => toggleCell(ri, ci)}
                      >
                        {cell.type === 'gap' ? 'Make text' : 'Make gap'}
                      </Button>
                    </div>
                    {cell.type === 'text' ? (
                      <input
                        type="text"
                        value={cell.text}
                        placeholder="Cell text"
                        onChange={(e) =>
                          patchCell(ri, ci, { type: 'text', text: e.target.value })
                        }
                        className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={answersToInput(cell.acceptedAnswers)}
                          placeholder="Accepted answers (comma-separated)"
                          onChange={(e) =>
                            patchGap(ri, ci, {
                              acceptedAnswers: inputToAnswers(e.target.value),
                            })
                          }
                          className="flex-1 min-w-[10rem] text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                        />
                        <input
                          type="number"
                          min={1}
                          value={cell.wordLimit ?? ''}
                          placeholder="Limit"
                          aria-label="Word limit for this gap"
                          onChange={(e) =>
                            patchGap(ri, ci, {
                              wordLimit: parseWordLimit(e.target.value),
                            })
                          }
                          className="w-24 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div>
          <Button variant="secondary" size="sm" onClick={addRow}>
            + Add row
          </Button>
        </div>
      </div>
    </div>
  )
}
