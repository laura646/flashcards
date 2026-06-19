'use client'

// Wave 0 — one reusable breadcrumb / page header.
//
// UX-pass fix: there was no breadcrumb anywhere and every screen grew its
// own mismatched "← Admin Console" back-link, so teachers got lost. This is
// the single contract used everywhere: Courses › Course › Lesson › Item, or
// To review › Student › Submission, etc. Accessible (<nav aria-label>,
// aria-current), keyboard-operable links, accessible sky-text, wraps on
// mobile, optional right-aligned actions.

import { ReactNode } from 'react'

export interface Crumb { label: string; onClick?: () => void }

export function PageHeader({ crumbs, actions, className = '' }: { crumbs: Crumb[]; actions?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap ${className}`}>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 flex-wrap text-[13px]">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={i} className="flex items-center gap-1.5 min-w-0">
                {c.onClick && !last ? (
                  <button
                    onClick={c.onClick}
                    className="text-sky-text hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                  >{c.label}</button>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'font-bold text-ink-black' : 'text-ink-muted'}>{c.label}</span>
                )}
                {!last && <span aria-hidden="true" className="text-ink-muted">›</span>}
              </li>
            )
          })}
        </ol>
      </nav>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export default PageHeader
