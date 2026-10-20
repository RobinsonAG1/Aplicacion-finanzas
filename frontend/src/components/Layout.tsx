import { Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { BrandMark } from './BrandMark'

type NavIconName =
  | 'home'
  | 'transactions'
  | 'budgets'
  | 'pots'
  | 'bills'
  | 'analytics'
  | 'accounts'
  | 'categories'

const NAV_ICONS: Record<NavIconName, ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </>
  ),
  transactions: (
    <>
      <path d="M4 8h14" />
      <path d="m15 5 3 3-3 3" />
      <path d="M20 16H6" />
      <path d="m9 13-3 3 3 3" />
    </>
  ),
  budgets: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  pots: (
    <>
      <path d="M7 9h10l-1 11H8L7 9Z" />
      <path d="M6 6h12v3H6z" />
    </>
  ),
  bills: (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </>
  ),
  accounts: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M16 14.5h2" />
    </>
  ),
  categories: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11l9 9-6.5 6.5-9-9z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
}

type NavItem = {
  to: string
  label: string
  end?: boolean
  icon: NavIconName
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Vista general',
    items: [
      { to: '/', label: 'Resumen', end: true, icon: 'home' },
      { to: '/transactions', label: 'Transacciones', icon: 'transactions' },
      { to: '/analytics', label: 'Analítica', icon: 'analytics' },
    ],
  },
  {
    label: 'Planificación',
    items: [
      { to: '/budgets', label: 'Presupuestos', icon: 'budgets' },
      { to: '/pots', label: 'Metas', icon: 'pots' },
      { to: '/bills', label: 'Facturas', icon: 'bills' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/accounts', label: 'Cuentas', icon: 'accounts' },
      { to: '/categories', label: 'Categorías', icon: 'categories' },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const currentSection = NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )
  const sectionLabel = currentSection?.label ?? 'Página no encontrada'
  const sectionIcon = currentSection ? NAV_ICONS[currentSection.icon] : null

  const initials = (user?.name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()

  useEffect(() => {
    if (!navOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const compactQuery = window.matchMedia('(max-width: 900px)')

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNavOpen(false)
        menuButtonRef.current?.focus()
        return
      }

      if (event.key !== 'Tab') return

      const focusables = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0)
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function handleCompactChange() {
      if (!compactQuery.matches) setNavOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    compactQuery.addEventListener('change', handleCompactChange)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      compactQuery.removeEventListener('change', handleCompactChange)
    }
  }, [navOpen])

  function closeNav() {
    setNavOpen(false)
    menuButtonRef.current?.focus()
  }

  function handleNavClick() {
    if (!navOpen) return
    setNavOpen(false)
    menuButtonRef.current?.focus()
  }

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside ref={sidebarRef} className={`sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="sidebar-head">
          <Link to="/" className="brand" aria-label="Finanzas, ir al resumen">
            <BrandMark size={34} />
            <span className="brand-text">
              <span className="brand-name">Finanzas</span>
              <span className="brand-sub">COP</span>
            </span>
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button sidebar-close"
            onClick={closeNav}
            aria-label="Cerrar menú"
            title="Cerrar menú"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav id="primary-navigation" className="nav" aria-label="Navegación principal">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={handleNavClick}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <svg
                    className="nav-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    {NAV_ICONS[item.icon]}
                  </svg>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="sidebar-foot-label">Apariencia</span>
          <ThemeToggle />
        </div>
      </aside>

      {navOpen && (
        <div className="nav-scrim" aria-hidden="true" onClick={closeNav} />
      )}

      <div className="main">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              ref={menuButtonRef}
              type="button"
              className="icon-button menu-toggle"
              onClick={() => setNavOpen(true)}
              aria-label="Menú de navegación"
              aria-expanded={navOpen}
              aria-controls="primary-navigation"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <nav className="breadcrumb" aria-label="Ruta de navegación">
              <Link to="/" className="breadcrumb-root">
                Finanzas
              </Link>
              <span className="breadcrumb-divider" aria-hidden="true">
                /
              </span>
              <span className="breadcrumb-current" aria-current="page">
                {sectionIcon && (
                  <svg
                    className="breadcrumb-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    {sectionIcon}
                  </svg>
                )}
                {sectionLabel}
              </span>
            </nav>
          </div>

          <div className="topbar-actions">
            <div className="topbar-user">
              <span className="avatar" aria-hidden="true">
                {initials}
              </span>
              <div className="topbar-identity">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
            <span className="topbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-button topbar-logout"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5" />
                <path d="m15 8 4 4-4 4M19 12H9" />
              </svg>
              <span className="topbar-logout-label">Cerrar sesión</span>
            </button>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<p className="muted">Cargando…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
