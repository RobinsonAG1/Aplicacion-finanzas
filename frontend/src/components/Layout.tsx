import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
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

const NAV_ITEMS: { to: string; label: string; end?: boolean; icon: NavIconName }[] = [
  { to: '/', label: 'Resumen', end: true, icon: 'home' },
  { to: '/transactions', label: 'Transacciones', icon: 'transactions' },
  { to: '/budgets', label: 'Presupuestos', icon: 'budgets' },
  { to: '/pots', label: 'Metas', icon: 'pots' },
  { to: '/bills', label: 'Facturas', icon: 'bills' },
  { to: '/analytics', label: 'Analítica', icon: 'analytics' },
  { to: '/accounts', label: 'Cuentas', icon: 'accounts' },
  { to: '/categories', label: 'Categorías', icon: 'categories' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initials = (user?.name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Ir al resumen">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-name">Finanzas</span>
            <span className="brand-sub">COP</span>
          </span>
        </Link>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="topbar-identity">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button type="button" className="btn" onClick={handleLogout}>
              Cerrar sesión
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
