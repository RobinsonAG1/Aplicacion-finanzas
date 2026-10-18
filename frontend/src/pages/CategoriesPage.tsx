import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { categoriesApi } from '../api/categories'
import type { Category, CategoryType } from '../api/types'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { useAsyncData } from '../hooks/useAsyncData'
import { errorMessage } from '../lib/errors'
import { CATEGORY_TYPE_LABELS, CATEGORY_TYPES } from '../lib/labels'

interface FormState {
  id?: string
  name: string
  type: CategoryType
  color: string
}

const EMPTY_FORM: FormState = { name: '', type: 'EXPENSE', color: '#64748b' }

export function CategoriesPage() {
  const load = useCallback(() => categoriesApi.list(), [])
  const { data: categories, error, loading, reload } = useAsyncData(load)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const editing = Boolean(form.id)

  function resetForm(): void {
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function openCreate(): void {
    resetForm()
    setDrawerOpen(true)
  }

  function closeDrawer(): void {
    setDrawerOpen(false)
    resetForm()
  }

  function startEdit(category: Category): void {
    setForm({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
    })
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (form.id) {
        await categoriesApi.update(form.id, { name: form.name, color: form.color })
      } else {
        await categoriesApi.create({ name: form.name, type: form.type, color: form.color })
      }
      closeDrawer()
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la categoría'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category): Promise<void> {
    const confirmed = window.confirm(
      `¿Eliminar la categoría "${category.name}"? Las transacciones quedarán sin categoría.`,
    )
    if (!confirmed) return
    try {
      await categoriesApi.remove(category.id)
      if (form.id === category.id) resetForm()
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo eliminar la categoría'))
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Categorías</h1>
          <p className="muted">Clasifica tus ingresos y gastos con colores.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Nueva categoría
        </button>
      </div>

      <div className="panel panel-standalone">
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="alert">{error}</p>}
        {!loading && !error && categories && categories.length === 0 && (
          <p className="muted">Aún no tienes categorías.</p>
        )}
        {categories && categories.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Tipo</th>
                <th className="cell-actions">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <span className="color-dot" style={{ backgroundColor: category.color }} />
                    {category.name}
                    {category.isCustom && <span className="badge">Propia</span>}
                  </td>
                  <td>{CATEGORY_TYPE_LABELS[category.type]}</td>
                  <td className="cell-actions">
                    <RowActionsMenu
                      label={`Acciones de ${category.name}`}
                      actions={[
                        { label: 'Editar', onSelect: () => startEdit(category) },
                        {
                          label: 'Eliminar',
                          onSelect: () => void handleDelete(category),
                          danger: true,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        label={editing ? 'Editar categoría' : 'Nueva categoría'}
      >
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2>{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
          {formError && <p className="alert">{formError}</p>}

          <label className="field">
            Nombre
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              maxLength={60}
            />
          </label>
          <label className="field">
            Tipo
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as CategoryType })}
              disabled={editing}
            >
              {CATEGORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CATEGORY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Color
            <input
              type="color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
          </label>
          {editing && <p className="muted small">El tipo no se puede cambiar.</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}
            </button>
            <button type="button" className="btn" onClick={closeDrawer}>
              Cancelar
            </button>
          </div>
        </form>
      </Drawer>
    </section>
  )
}
