import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="center-screen">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
