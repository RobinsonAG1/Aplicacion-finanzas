import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const FIRST_FIELD =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'

type DrawerProps = {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

export function Drawer({ open, onClose, label, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const target =
      panel?.querySelector<HTMLElement>(FIRST_FIELD) ??
      panel?.querySelector<HTMLElement>('.btn-primary:not([disabled])') ??
      panel
    target?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      )
      if (nodes.length === 0) return

      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === firstNode || active === panel)) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && active === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        data-testid="drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <button
          type="button"
          className="drawer-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="drawer-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}
