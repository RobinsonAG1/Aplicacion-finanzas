import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { budgetsApi } from '../api/budgets'
import type { BudgetInput, BudgetSummary } from '../api/budgets'
import { categoriesApi } from '../api/categories'
import type { BudgetPeriod } from '../api/types'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { useAsyncData } from '../hooks/useAsyncData'
import { endOfMonthInput, formatDate, startOfMonthInput, toDateInputValue } from '../lib/dates'
import { formatCOP } from '../lib/formatCOP'
import { BUDGET_PERIOD_LABELS, BUDGET_PERIODS } from '../lib/labels'

interface FormState {
  id?: string
  categoryId: string
  limitAmount: string
  period: BudgetPeriod
  startDate: string
  endDate: string
}

function emptyForm(): FormState {
  return {
    categoryId: '',
    limitAmount: '',
    period: 'MONTHLY',
    startDate: toDateInputValue(new Date()),
    endDate: '',
  }
}

function progressClass(summary: BudgetSummary): string {
  if (summary.exceeded) return 'progress-fill danger'
  if (summary.percentage >= 80) return 'progress-fill warn'
  return 'progress-fill'
}

export function BudgetsPage() {
  const [from, setFrom] = useState(startOfMonthInput())
  const [to, setTo] = useState(endOfMonthInput())
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadOverview = useCallback(
    () => budgetsApi.overview(`${from}T00:00:00.000`, `${to}T23:59:59.999`),
    [from, to],
  )
  const { data: overview, error, loading, reload } = useAsyncData(loadOverview)
  const loadCategories = useCallback(() => categoriesApi.list(), [])
  const { data: categories } = useAsyncData(loadCategories)

  const expenseCategories = (categories ?? []).filter((category) => category.type === 'EXPENSE')
  const summaries = overview?.budgets ?? []
  const editing = Boolean(form.id)

  function resetForm(): void {
    setForm(emptyForm())
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

  function startEdit(summary: BudgetSummary): void {
    setForm({
      id: summary.id,
      categoryId: summary.category.id,
      limitAmount: String(Number(summary.limitAmount)),
      period: summary.period,
      startDate: toDateInputValue(summary.startDate),
      endDate: summary.endDate ? toDateInputValue(summary.endDate) : '',
    })
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload: BudgetInput = {
        categoryId: form.categoryId,
        limitAmount: Number(form.limitAmount),
        period: form.period,
        startDate: form.startDate,
        endDate: form.endDate || null,
      }
      if (form.id) {
        await budgetsApi.update(form.id, payload)
      } else {
        await budgetsApi.create(payload)
      }
      closeDrawer()
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el presupuesto')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(summary: BudgetSummary): Promise<void> {
    if (!window.confirm(`¿Eliminar el presupuesto de "${summary.category.name}"?`)) return
    setActionError(null)
    try {
      await budgetsApi.remove(summary.id)
      if (form.id === summary.id) {
        resetForm()
        setDrawerOpen(false)
      }
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el presupuesto')
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Presupuestos</h1>
          <p className="muted">Define límites de gasto por categoría y sigue su avance.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Nuevo presupuesto
        </button>
      </div>

      <div className="filters panel">
        <label className="field inline-field">
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field inline-field">
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setFrom(startOfMonthInput())
            setTo(endOfMonthInput())
          }}
        >
          Mes actual
        </button>
      </div>

      {actionError && <p className="alert">{actionError}</p>}

      <div className="cards">
        <div className="card">
          <span className="card-label">Límite total</span>
          <span className="card-value">{formatCOP(overview?.totals.limitAmount ?? 0)}</span>
        </div>
        <div className="card">
          <span className="card-label">Gastado</span>
          <span className="card-value amount-expense">
            {formatCOP(overview?.totals.spent ?? 0)}
          </span>
        </div>
        <div className="card">
          <span className="card-label">Disponible</span>
          <span className="card-value amount-income">
            {formatCOP(overview?.totals.remaining ?? 0)}
          </span>
        </div>
      </div>

      <div className="panel panel-standalone">
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="alert">{error}</p>}
        {!loading && !error && summaries.length === 0 && (
          <p className="muted">No hay presupuestos para el periodo seleccionado.</p>
        )}
        <div className="budget-list">
          {summaries.map((summary) => (
            <article key={summary.id} className="budget-card">
              <div className="budget-head">
                <span className="budget-cat">
                  <span
                    className="color-dot"
                    style={{ backgroundColor: summary.category.color }}
                  />
                  {summary.category.name}
                  <span className="badge">{BUDGET_PERIOD_LABELS[summary.period]}</span>
                </span>
                <span className="budget-amounts">
                  {formatCOP(summary.spent)} / {formatCOP(summary.limitAmount)}
                </span>
              </div>
              <div className="progress">
                <div
                  className={progressClass(summary)}
                  style={{ width: `${Math.min(100, summary.percentage)}%` }}
                />
              </div>
              <div className="budget-foot">
                <span className={`small ${summary.exceeded ? 'amount-expense' : 'muted'}`}>
                  {summary.exceeded
                    ? `Excedido en ${formatCOP(Math.abs(summary.remaining))}`
                    : `Disponible ${formatCOP(summary.remaining)}`}
                </span>
                <span className="muted small">{summary.percentage.toFixed(1)}%</span>
                <span className="row-actions">
                  <RowActionsMenu
                    label={`Acciones de ${summary.category.name}`}
                    actions={[
                      { label: 'Editar', onSelect: () => startEdit(summary) },
                      {
                        label: 'Eliminar',
                        onSelect: () => void handleDelete(summary),
                        danger: true,
                      },
                    ]}
                  />
                </span>
              </div>
            </article>
          ))}
        </div>
        {overview && (
          <p className="muted small">
            Periodo: {formatDate(overview.from)} — {formatDate(overview.to)}
          </p>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        label={editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      >
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2>{editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
          {formError && <p className="alert">{formError}</p>}

          <label className="field">
            Categoría de gasto
            <select
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              required
            >
              <option value="">Selecciona…</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Límite (COP)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.limitAmount}
              onChange={(event) => setForm({ ...form, limitAmount: event.target.value })}
              required
            />
          </label>

          <label className="field">
            Periodicidad
            <select
              value={form.period}
              onChange={(event) => setForm({ ...form, period: event.target.value as BudgetPeriod })}
            >
              {BUDGET_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {BUDGET_PERIOD_LABELS[period]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Inicio
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              required
            />
          </label>

          <label className="field">
            Fin (opcional)
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear presupuesto'}
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
