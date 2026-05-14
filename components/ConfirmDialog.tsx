'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// ConfirmDialog — branded replacement for native window.confirm()
//
// Usage:
//   const confirm = useConfirm()
//   if (await confirm({ title: 'Delete?', message: 'Are you sure?', danger: true })) { ... }
//
// Wrap your subtree with <ConfirmProvider>. (Already wired into the
// admin and superadmin layouts.)
// ═══════════════════════════════════════════════════════════════

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** If true, the primary button is styled in red (destructive action). */
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      setOpts(o)
      // Wrap so React doesn't unwrap the function-style state update
      setResolver(() => resolve)
    })
  }, [])

  const close = useCallback(
    (val: boolean) => {
      resolver?.(val)
      setResolver(null)
      setOpts(null)
    },
    [resolver]
  )

  // Esc to cancel
  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      else if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 animate-fade-in"
          onClick={() => close(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-[#46464b]">{opts.title}</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed whitespace-pre-wrap">
              {opts.message}
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => close(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-[#46464b]"
              >
                {opts.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${
                  opts.danger
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#416ebe] hover:bg-[#3560b0]'
                }`}
                autoFocus
              >
                {opts.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
