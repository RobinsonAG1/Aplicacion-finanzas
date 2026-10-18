import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type RowAction = {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

const MENU_WIDTH = 190
const MENU_GAP = 4
const VIEWPORT_MARGIN = 8

type MenuPosition = { top: number; left: number }

function computePosition(rect: DOMRect, height: number): MenuPosition {
  let top = rect.bottom + MENU_GAP
  const fitsAbove =
    rect.top - MENU_GAP - height >= VIEWPORT_MARGIN
  if (top + height > window.innerHeight - VIEWPORT_MARGIN && fitsAbove) {
    top = rect.top - height - MENU_GAP
  }
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
  )
  return { top, left }
}

type RowActionsMenuProps = {
  actions: RowAction[]
  label?: string
}

export function RowActionsMenu({
  actions,
  label = 'Más acciones',
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }

    const trigger = triggerRef.current
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      rectRef.current = rect
      setPosition(computePosition(rect, 0))
    }

    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return

    const menu = menuRef.current
    const rect = rectRef.current
    if (!menu || !rect) return

    setPosition(computePosition(rect, menu.getBoundingClientRect().height))
  }, [open])

  useEffect(() => {
    if (!open) return

    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus()

    function focusRelative(step: number) {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          [],
      )
      if (items.length === 0) return
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = (current + step + items.length) % items.length
      items[next]?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusRelative(1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusRelative(-1)
      }
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    function handleViewportChange(event: Event) {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) return

      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) {
        setOpen(false)
        return
      }

      const rect = trigger.getBoundingClientRect()
      rectRef.current = rect
      setPosition(computePosition(rect, menu.getBoundingClientRect().height))
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open])

  function select(action: RowAction) {
    setOpen(false)
    triggerRef.current?.focus()
    action.onSelect()
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="5" cy="12" r="1.8" fill="currentColor" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="19" cy="12" r="1.8" fill="currentColor" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="action-menu"
            role="menu"
            aria-label={label}
            style={{ top: position.top, left: position.left }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                className={
                  action.danger
                    ? 'action-menu-item danger'
                    : 'action-menu-item'
                }
                disabled={action.disabled}
                onClick={() => select(action)}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
