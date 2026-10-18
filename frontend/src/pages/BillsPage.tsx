import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { accountsApi } from '../api/accounts'
import { billsApi } from '../api/bills'
import type { Bill, BillInput, RunRemindersResult } from '../api/bills'
import { categoriesApi } from '../api/categories'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { BillPayPanel } from '../features/bills/BillPayPanel'
import { BillRemindersPanel } from '../features/bills/BillRemindersPanel'
import { useAsyncData } from '../hooks/useAsyncData'
import { expenseCategories } from '../lib/categories'
import { formatDate } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { formatCOP } from '../lib/formatCOP'

interface FormState {
  id?: string
  name: string
  amount: string
  categoryId: string
  dueDay: string
  isActive: boolean
}

const EMPTY_FORM: FormState = { name: '', amount: '', categoryId: '', dueDay: '1', isActive: true }

type PanelMode = 'form' | 'pay' | 'reminders'

export function BillsPage() {
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunRemindersResult | null>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<PanelMode>('form')
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadBills = useCallback(() => {
    const parsed = activeFilter === '' ? undefined : activeFilter === 'true'
    return billsApi.list(parsed)
  }, [activeFilter])
  const { data: bills, error, loading, reload } = useAsyncData(loadBills)
  const loadAccounts = useCallback(() => accountsApi.list(), [])
  const { data: accounts } = useAsyncData(loadAccounts)
  const loadCategories = useCallback(() => categoriesApi.list(), [])
  const { data: categories } = useAsyncData(loadCategories)

  const editing = Boolean(form.id)

  function resetForm(): void {
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function openCreate(): void {
    resetForm()
    setMode('form')
    setDrawerOpen(true)
  }

  function closeDrawer(): void {
    setDrawerOpen(false)
    setMode('form')
    setSelectedBill(null)
    resetForm()
  }

  function startEdit(bill: Bill): void {
    setForm({
      id: bill.id,
      name: bill.name,
      amount: String(Number(bill.amount)),
      categoryId: bill.category?.id ?? '',
      dueDay: String(bill.dueDay),
      isActive: bill.isActive,
    })
    setFormError(null)
    setMode('form')
    setDrawerOpen(true)
  }

  function startPanel(bill: Bill, next: Exclude<PanelMode, 'form'>): void {
    setSelectedBill(bill)
    setMode(next)
    setDrawerOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload: BillInput = {
        name: form.name,
        amount: Number(form.amount),
        categoryId: form.categoryId || null,
        dueDay: Number(form.dueDay),
        isActive: form.isActive,
      }
      if (form.id) {
        await billsApi.update(form.id, payload)
      } else {
        await billsApi.create(payload)
      }
      closeDrawer()
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la factura'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bill: Bill): Promise<void> {
    if (!window.confirm(`¿Eliminar la factura "${bill.name}"?`)) return
    setActionError(null)
    try {
      await billsApi.remove(bill.id)
      if (form.id === bill.id) resetForm()
      if (selectedBill?.id === bill.id) closeDrawer()
      await reload()
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo eliminar la factura'))
    }
  }

  async function handleToggleActive(bill: Bill): Promise<void> {
    setActionError(null)
    try {
      await billsApi.update(bill.id, { isActive: !bill.isActive })
      await reload()
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo actualizar la factura'))
    }
  }

  async function handleRunReminders(): Promise<void> {
    setRunning(true)
    setActionError(null)
    setRunResult(null)
    try {
      const result = await billsApi.runReminders({ days: 7, channel: 'LOG' })
      setRunResult(result)
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudieron generar los recordatorios'))
    } finally {
      setRunning(false)
    }
  }

  const drawerLabel =
    mode === 'pay' && selectedBill
      ? `Pagar ${selectedBill.name}`
      : mode === 'reminders' && selectedBill
        ? `Recordatorios · ${selectedBill.name}`
        : editing
          ? 'Editar factura'
          : 'Nueva factura'

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Facturas recurrentes</h1>
          <p className="muted">Controla vencimientos, pagos y recordatorios.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void handleRunReminders()}
            disabled={running}
          >
            {running ? 'Generando…' : 'Generar recordatorios (7 días)'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nueva factura
          </button>
        </div>
      </div>

      {runResult && (
        <p className="notice">
          Recordatorios: {runResult.created} creados, {runResult.skipped} omitidos.
        </p>
      )}
      {actionError && <p className="alert">{actionError}</p>}

      <div className="filters panel">
        <select
          value={activeFilter}
          aria-label="Filtrar por estado"
          onChange={(event) => setActiveFilter(event.target.value as '' | 'true' | 'false')}
        >
          <option value="">Todas</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </div>

      <div className="panel">
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="alert">{error}</p>}
        {!loading && !error && (bills ?? []).length === 0 && (
          <p className="muted">No hay facturas registradas.</p>
        )}
        {(bills ?? []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="right">Monto</th>
                <th>Categoría</th>
                <th>Vence</th>
                <th>Estado</th>
                <th className="cell-actions">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(bills ?? []).map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.name}</td>
                  <td className="right">{formatCOP(bill.amount)}</td>
                  <td>
                    {bill.category ? (
                      <span className="category-cell">
                        <span
                          className="color-dot"
                          style={{ backgroundColor: bill.category.color }}
                        />
                        {bill.category.name}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div>{formatDate(bill.nextDueDate)}</div>
                    <div className={`small ${bill.overdue ? 'amount-expense' : 'muted'}`}>
                      {bill.overdue ? 'Vencida' : `en ${bill.daysUntil} d`}
                    </div>
                  </td>
                  <td>
                    {bill.overdue ? (
                      <span className="badge badge-danger">Vencida</span>
                    ) : bill.isActive ? (
                      <span className="badge">Activa</span>
                    ) : (
                      <span className="badge">Inactiva</span>
                    )}
                  </td>
                  <td className="cell-actions">
                    <span className="row-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => startPanel(bill, 'pay')}
                      >
                        Pagar
                      </button>
                      <RowActionsMenu
                        label={`Acciones de ${bill.name}`}
                        actions={[
                          { label: 'Recordatorios', onSelect: () => startPanel(bill, 'reminders') },
                          {
                            label: bill.isActive ? 'Desactivar' : 'Activar',
                            onSelect: () => void handleToggleActive(bill),
                          },
                          { label: 'Editar', onSelect: () => startEdit(bill) },
                          {
                            label: 'Eliminar',
                            onSelect: () => void handleDelete(bill),
                            danger: true,
                          },
                        ]}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} label={drawerLabel}>
        {mode === 'pay' && selectedBill ? (
          <BillPayPanel
            key={selectedBill.id}
            bill={selectedBill}
            accounts={accounts ?? []}
            onPaid={async () => {
              await reload()
            }}
            onClose={closeDrawer}
          />
        ) : mode === 'reminders' && selectedBill ? (
          <BillRemindersPanel
            key={selectedBill.id}
            bill={selectedBill}
            onClose={closeDrawer}
          />
        ) : (
          <form className="panel form-panel" onSubmit={handleSubmit}>
            <h2>{editing ? 'Editar factura' : 'Nueva factura'}</h2>
            {formError && <p className="alert">{formError}</p>}

            <label className="field">
              Nombre
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                maxLength={80}
              />
            </label>
            <label className="field">
              Monto (COP)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                required
              />
            </label>
            <label className="field">
              Categoría (gasto)
              <select
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Sin categoría</option>
                {expenseCategories(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Día de vencimiento (1-31)
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(event) => setForm({ ...form, dueDay: event.target.value })}
                required
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Activa
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear factura'}
              </button>
              <button type="button" className="btn" onClick={closeDrawer}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </section>
  )
}
