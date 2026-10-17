import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('demo@finanzas.test')
  const [password, setPassword] = useState('Demo1234!')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login({ email, password })
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="muted">Finanzas personales en pesos colombianos</p>

        {error && <p className="alert">{error}</p>}

        <label className="field">
          Correo
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Entrar'}
        </button>

        <p className="muted">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </form>
    </div>
  )
}
