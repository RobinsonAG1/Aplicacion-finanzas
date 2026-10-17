interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">
        {description ?? 'Esta sección se implementará en una próxima tarea.'}
      </p>
    </section>
  )
}
