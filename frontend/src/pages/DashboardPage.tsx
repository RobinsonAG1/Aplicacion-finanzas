import { useAuth } from '../features/auth/useAuth'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <section className="page">
      <h1>Hola, {user?.name}</h1>
      <p className="muted">Aquí verás el resumen de tus finanzas en pesos colombianos.</p>
      <div className="cards">
        {['Ingresos', 'Gastos', 'Balance neto', 'Tasa de ahorro'].map((label) => (
          <article key={label} className="card">
            <span className="card-label">{label}</span>
            <span className="card-value">—</span>
          </article>
        ))}
      </div>
    </section>
  )
}
