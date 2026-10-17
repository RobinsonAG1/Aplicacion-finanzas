import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

const NAV_ITEMS = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/transactions', label: 'Transacciones' },
  { to: '/budgets', label: 'Presupuestos' },
  { to: '/pots', label: 'Huchas' },
  { to: '/bills', label: 'Facturas' },
  { to: '/analytics', label: 'Analítica' },
  { to: '/accounts', label: 'Cuentas' },
  { to: '/categories', label: 'Categorías' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Finanzas COP</div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-user">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" className="btn" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
