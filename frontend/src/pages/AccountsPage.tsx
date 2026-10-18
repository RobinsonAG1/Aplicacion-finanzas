import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { accountsApi } from '../api/accounts'
import type { Account, AccountType } from '../api/types'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCOP } from '../lib/formatCOP'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from '../lib/labels'

interface FormState {
  id?: string
  name: string
  type: AccountType
  balance: string
}

const EMPTY_FORM: FormState = { name: '', type: 'SAVINGS', balance: '0' }

export function AccountsPage() {
  const load = useCallback(() => accountsApi.list(), [])
  const { data: accounts, error, loading, reload } = useAsyncData(load)
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

  function startEdit(account: Account): void {
    setForm({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: String(Number(account.balance)),
    })
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name,
        type: form.type,
        balance: Number(form.balance) || 0,
      }
      if (form.id) {
        await accountsApi.update(form.id, payload)
      } else {
        await accountsApi.create(payload)
      }
      closeDrawer()
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(account: Account): Promise<void> {
    const confirmed = window.confirm(
      `¿Eliminar la cuenta "${account.name}"? También se eliminarán sus transacciones.`,
    )
    if (!confirmed) return
    try {
      await accountsApi.remove(account.id)
      if (form.id === account.id) resetForm()
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta')
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Cuentas</h1>
          <p className="muted">Administra tus cuentas y su saldo en pesos colombianos.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Nueva cuenta
        </button>
      </div>

      <div className="panel panel-standalone">
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="alert">{error}</p>}
        {!loading && !error && accounts && accounts.length === 0 && (
          <p className="muted">Aún no tienes cuentas. Crea la primera.</p>
        )}
        {accounts && accounts.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th className="right">Saldo</th>
                <th className="cell-actions">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{ACCOUNT_TYPE_LABELS[account.type]}</td>
                  <td className="right">{formatCOP(account.balance)}</td>
                  <td className="cell-actions">
                    <RowActionsMenu
                      label={`Acciones de ${account.name}`}
                      actions={[
                        { label: 'Editar', onSelect: () => startEdit(account) },
                        {
                          label: 'Eliminar',
                          onSelect: () => void handleDelete(account),
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
        label={editing ? 'Editar cuenta' : 'Nueva cuenta'}
      >
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2>{editing ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
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
            Tipo
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Saldo inicial
            <input
              type="number"
              value={form.balance}
              onChange={(event) => setForm({ ...form, balance: event.target.value })}
              step="0.01"
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cuenta'}
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
