import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from './BrandMark'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <aside className="auth-brand">
        <Link to="/login" className="brand auth-brand-link" aria-label="Finanzas COP">
          <BrandMark size={34} />
          <span className="brand-text">
            <span className="brand-name">Finanzas</span>
            <span className="brand-sub">COP</span>
          </span>
        </Link>

        <div className="auth-brand-copy">
          <p className="auth-eyebrow">Control personal</p>
          <h2>Cada peso, en su lugar.</h2>
          <p>
            Registra ingresos, gastos, presupuestos y facturas en pesos colombianos, con una
            vista clara de tu saldo.
          </p>
        </div>

        <ul className="auth-points">
          <li>Resumen de saldo y movimientos</li>
          <li>Presupuestos y metas de ahorro</li>
          <li>Facturas y recordatorios de pago</li>
        </ul>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <header className="auth-head">
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  )
}
