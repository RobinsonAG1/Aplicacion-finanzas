import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>404</h1>
      <p className="muted">La página que buscas no existe.</p>
      <Link className="btn" to="/">
        Volver al resumen
      </Link>
    </section>
  )
}
