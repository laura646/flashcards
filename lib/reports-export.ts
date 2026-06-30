// ═══════════════════════════════════════════════════════════════
// lib/reports-export.ts
//
// Client-side report export — no external libraries, no server round-trip.
// Excel: a UTF-8 CSV (opens in Excel), one row per learner.
// PDF:   a branded, self-contained HTML document (one page per learner)
//        opened in a new window and sent to the browser's print → Save as PDF.
// Rebuilt from the retired legacy export (commits 7c2764c + b5fa3a7) on the
// current StudentReport shape.
// ═══════════════════════════════════════════════════════════════

import type { StudentReport } from '@/components/admin-v2/ReportsView'

export type ExportSection = 'summary' | 'kpis' | 'cefr' | 'attendance' | 'tests' | 'notes'

export type GroupSection = 'summary' | 'progress' | 'overview' | 'shortlists'

export interface ExportOptions {
  courseName: string
  currentLevel: string | null
  goalLevel: string | null
  sections: Set<ExportSection>
  groupSections?: Set<GroupSection>
  overview?: { summary: string; needs: string; ready: string } | null
  groupProgressPct?: number | null
  periodLabel?: string
}

function has(sections: Set<ExportSection>, s: ExportSection): boolean {
  return sections.has(s)
}

function attendanceCounts(r: StudentReport) {
  let present = 0
  let late = 0
  let absent = 0
  let excused = 0
  for (const a of r.attendance) {
    if (a.status === 'present') present++
    else if (a.status === 'late') late++
    else if (a.status === 'absent') absent++
    else if (a.status === 'excused') excused++
  }
  const total = r.attendance.length
  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : null
  return { present, late, absent, excused, total, pct }
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildReportCsv(students: StudentReport[], opts: ExportOptions): string {
  const cols: { header: string; get: (r: StudentReport) => string | number }[] = [
    { header: 'Learner', get: (r) => r.name },
    { header: 'Email', get: (r) => r.email },
  ]
  if (has(opts.sections, 'cefr')) {
    cols.push({ header: 'Current level', get: () => opts.currentLevel || '' })
    cols.push({ header: 'Goal level', get: () => opts.goalLevel || '' })
    cols.push({ header: 'Course progress %', get: (r) => r.courseProgressPct ?? '' })
  }
  if (has(opts.sections, 'kpis')) {
    cols.push({ header: 'Words learned', get: (r) => r.wordsLearned })
    cols.push({ header: 'Completion %', get: (r) => r.completionPct })
    cols.push({ header: 'Avg score %', get: (r) => r.avgLatestPct ?? '' })
    cols.push({ header: 'Streak', get: (r) => r.streak })
    cols.push({ header: 'Group rank', get: (r) => (r.groupRank != null ? `${r.groupRank}/${r.groupSize}` : '') })
  }
  if (has(opts.sections, 'attendance')) {
    cols.push({ header: 'Attendance %', get: (r) => attendanceCounts(r).pct ?? '' })
  }
  if (has(opts.sections, 'tests')) {
    cols.push({ header: 'Tests taken', get: (r) => r.tests.length + r.manualTests.length })
  }
  if (has(opts.sections, 'summary')) {
    cols.push({ header: 'AI summary', get: (r) => r.aiSummary || '' })
  }

  const rows = [cols.map((c) => csvCell(c.header)).join(',')]
  for (const r of students) rows.push(cols.map((c) => csvCell(c.get(r))).join(','))
  return rows.join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildReportHtml(students: StudentReport[], opts: ExportOptions, generatedOn: string): string {
  // Page 1 — group summary (cohort overview).
  const n = students.length
  const mean = (arr: number[]): number | null => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
  const avgCompletion = mean(students.map((s) => s.completionPct)) ?? 0
  const avgScore = mean(students.map((s) => s.avgLatestPct).filter((x): x is number => x != null))
  const avgAtt = mean(students.map((s) => s.attendancePct).filter((x): x is number => x != null))
  const streaks = students.filter((s) => s.streak > 0).length

  // Branding + period + reusable header. Logo is absolute (the print window
  // has no base URL); logo-onblue.png suits the blue header band.
  const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://app.englishwithlaura.com'
  const logo = `<img class="logo" src="${ORIGIN}/logo-onblue.png" alt="English with Laura" />`
  const period = opts.periodLabel ? `${esc(opts.periodLabel)} · ` : ''
  const hdr = (subtitle: string, metaLines: string) =>
    `<div class="hd"><div class="hl">${logo}<div class="subh">${subtitle}</div></div><div class="meta">${metaLines}</div></div>`

  // Cohort shortlists for the cover.
  const topPerformers = students
    .slice()
    .sort((a, b) => (b.avgLatestPct ?? -1) - (a.avgLatestPct ?? -1) || b.completionPct - a.completionPct)
    .slice(0, 3)
  const needsList = students
    .filter((s) => s.completionPct < 50 || (s.attendancePct != null && s.attendancePct < 70) || (s.avgLatestPct != null && s.avgLatestPct < 60))
    .sort((a, b) => a.completionPct - b.completionPct)
    .slice(0, 3)
  const gs = opts.groupSections ?? new Set<GroupSection>(['summary', 'progress', 'overview'])
  const ov = opts.overview
  const gp = opts.groupProgressPct
  const cur = esc(opts.currentLevel || '—')
  const gl = esc(opts.goalLevel || '—')
  const coverParts: string[] = []
  if (gs.has('progress')) {
    coverParts.push(
      `<div class="sec"><div class="h">Where the group is</div>` +
        `<div style="font-size:11px;font-weight:700;display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#0098D4">Current · ${cur}</span><span style="color:#1A7F46">Goal · ${gl}</span></div>` +
        `<div style="height:10px;background:#E6ECF3;border-radius:20px;overflow:hidden;"><div style="height:100%;width:${gp ?? 0}%;background:#1A9E5C;border-radius:20px;"></div></div>` +
        `<p style="font-size:11px;color:#6B7280;margin-top:6px;">${gp != null ? `The group is ${gp}% of the way from ${cur} to ${gl}.` : 'Not set.'}</p></div>`
    )
  }
  if (gs.has('summary')) {
    coverParts.push(
      `<div class="sec"><div class="h">Group summary</div><table class="kpi"><tr>` +
        `<td><b>${n}</b><span>Learners</span></td>` +
        `<td><b>${avgCompletion}%</b><span>Avg completion</span></td>` +
        `<td><b>${avgScore != null ? avgScore + '%' : '—'}</b><span>Avg score</span></td>` +
        `<td><b>${avgAtt != null ? avgAtt + '%' : '—'}</b><span>Attendance</span></td>` +
        `<td><b>${streaks}/${n}</b><span>On a streak</span></td>` +
        `</tr></table></div>`
    )
  }
  if (gs.has('overview') && ov && (ov.summary || ov.needs || ov.ready)) {
    coverParts.push(
      `<div class="sec"><div class="h">AI overview</div>` +
        (ov.summary ? `<p><b>Summary.</b> ${esc(ov.summary)}</p>` : '') +
        (ov.needs ? `<p style="margin-top:6px;"><b>Needs attention.</b> ${esc(ov.needs)}</p>` : '') +
        (ov.ready ? `<p style="margin-top:6px;"><b>Ready to level up.</b> ${esc(ov.ready)}</p>` : '') +
        `</div>`
    )
  }
  if (gs.has('shortlists')) {
    coverParts.push(
      `<div class="sec"><div class="h">Top performers</div>` +
        (topPerformers.length
          ? `<ul>${topPerformers.map((s) => `<li>${esc(s.name)} — ${s.avgLatestPct != null ? s.avgLatestPct + '% avg score' : 'no score'}, ${s.completionPct}% complete</li>`).join('')}</ul>`
          : '<p>—</p>') +
        `</div>` +
        `<div class="sec"><div class="h">Needs attention</div>` +
        (needsList.length
          ? `<ul>${needsList.map((s) => `<li>${esc(s.name)} — ${s.completionPct}% complete${s.avgLatestPct != null ? `, ${s.avgLatestPct}% avg score` : ''}</li>`).join('')}</ul>`
          : '<p>Everyone is on track.</p>') +
        `</div>`
    )
  }
  const coverShown = coverParts.length > 0
  const totalPages = (coverShown ? 1 : 0) + students.length
  const footer = (pageNum: number) =>
    `<div class="ft"><span>English with Laura · Confidential</span><span>Page ${pageNum} of ${totalPages}</span></div>`
  const cover = coverShown
    ? `<section class="page">` +
      hdr('Group report', `${period}${esc(generatedOn)}`) +
      `<div class="who"><div class="nm">${esc(opts.courseName)}</div><div class="em">${n} learner${n === 1 ? '' : 's'} · Level ${cur} → ${gl}</div></div>` +
      coverParts.join('') +
      footer(1) +
      `</section>`
    : ''

  const pages = students
    .map((r, i) => {
      const att = attendanceCounts(r)
      const parts: string[] = []
      parts.push(hdr('Learner progress report', `${esc(opts.courseName)}<br>${period}${esc(generatedOn)}`))
      parts.push(`<div class="who"><div class="nm">${esc(r.name)}</div><div class="em">${esc(r.email)}</div></div>`)
      if (has(opts.sections, 'summary') && r.aiSummary) {
        parts.push(`<div class="sec"><div class="h">Summary</div><p>${esc(r.aiSummary)}</p></div>`)
      }
      if (has(opts.sections, 'kpis')) {
        parts.push(
          `<div class="sec"><div class="h">Key metrics</div><table class="kpi"><tr>` +
            `<td><b>${r.wordsLearned}</b><span>Words learned</span></td>` +
            `<td><b>${r.completionPct}%</b><span>Completion</span></td>` +
            `<td><b>${r.avgLatestPct ?? '—'}${r.avgLatestPct != null ? '%' : ''}</b><span>Avg score</span></td>` +
            `<td><b>${r.streak}</b><span>Streak</span></td>` +
            `<td><b>${r.groupRank != null ? '#' + r.groupRank : '—'}</b><span>Group rank</span></td>` +
            `</tr></table></div>`
        )
      }
      if (has(opts.sections, 'cefr')) {
        parts.push(
          `<div class="sec"><div class="h">CEFR progress</div><p>${esc(opts.currentLevel || '—')} → ${esc(opts.goalLevel || '—')}${r.courseProgressPct != null ? ` · ${r.courseProgressPct}% through the course` : ''}</p></div>`
        )
      }
      if (has(opts.sections, 'attendance')) {
        parts.push(
          `<div class="sec"><div class="h">Attendance</div><p>${att.pct != null ? att.pct + '%' : '—'} · ${att.present} present, ${att.late} late, ${att.absent} absent${att.excused ? `, ${att.excused} excused` : ''}</p></div>`
        )
      }
      if (has(opts.sections, 'tests')) {
        const tests = [
          ...r.tests.map((t) => `${esc(t.title)}: ${t.score}%`),
          ...r.manualTests.map((t) => `${esc(t.name)} (${esc(t.source)}): ${t.scorePct != null ? t.scorePct + '%' : '—'}`),
        ]
        parts.push(`<div class="sec"><div class="h">Tests</div>${tests.length ? `<ul>${tests.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p>No tests.</p>'}</div>`)
      }
      if (has(opts.sections, 'notes')) {
        parts.push(
          `<div class="sec"><div class="h">Teacher's notes</div>${r.notes.length ? r.notes.map((n) => `<p><b>${esc(n.tag)}</b> ${esc(n.text)}</p>`).join('') : '<p>No notes.</p>'}</div>`
        )
      }
      parts.push(footer((coverShown ? 1 : 0) + i + 1))
      return `<section class="page">${parts.join('')}</section>`
    })
    .join('')

  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Report — ${esc(opts.courseName)}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">` +
    `<style>` +
    `*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `body{font-family:'Lato',Arial,Helvetica,sans-serif;color:#333}` +
    `.page{padding:32px;max-width:760px;margin:0 auto}` +
    `.page+.page{page-break-before:always}` +
    `.hd{display:flex;justify-content:space-between;align-items:center;background:#00AFF0;color:#fff;padding:16px 22px;border-radius:10px}` +
    `.brand{font-size:17px;font-weight:700}.subh{font-size:12px;opacity:.9}` +
    `.meta{font-size:11px;text-align:right;opacity:.95}` +
    `.who{margin:18px 0 4px}.nm{font-size:20px;font-weight:700;color:#1A1A1A}.em{font-size:12px;color:#6B7280}` +
    `.sec{margin-top:16px}.sec .h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0098D4;border-bottom:1px solid #E4EBF3;padding-bottom:5px;margin-bottom:8px}` +
    `.sec p{font-size:13px;line-height:1.5;margin:4px 0}` +
    `.sec ul{margin:4px 0 4px 18px}.sec li{font-size:13px;line-height:1.6}` +
    `table.kpi{width:100%;border-collapse:collapse}table.kpi td{text-align:left;padding:4px 8px 4px 0;vertical-align:top}table.kpi b{display:block;font-size:18px;color:#1A1A1A}table.kpi span{font-size:11px;color:#6B7280}` +
    `.hl{display:flex;flex-direction:column;gap:3px;align-items:flex-start}` +
    `.logo{height:30px;width:auto}` +
    `.ft{margin-top:24px;border-top:1px solid #E4EBF3;padding-top:8px;font-size:10px;color:#9AA3AF;display:flex;justify-content:space-between}` +
    `@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0}}` +
    `</style></head><body>${cover}${pages}</body></html>`
  )
}

export function openPrintWindow(html: string): void {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Print exactly once, and only after the Lato webfont (and logo) have loaded —
  // otherwise the dialog can fire before Lato arrives and the PDF renders in a
  // fallback font. fonts.ready resolves when all used fonts settle; a timer is
  // the safety net if the font API is unavailable or hangs.
  let printed = false
  const go = () => {
    if (printed) return
    printed = true
    try {
      w.focus()
      w.print()
    } catch {
      /* user can print manually */
    }
  }
  w.onload = () => {
    const fonts = (w.document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts && typeof fonts.ready?.then === 'function') fonts.ready.then(go).catch(go)
    else go()
  }
  setTimeout(go, 2500)
}
