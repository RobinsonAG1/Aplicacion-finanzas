import { useState } from 'react'
import type { FormEvent } from 'react'
import { billsApi } from '../../api/bills'
import type { Bill } from '../../api/bills'
import type { Account } from '../../api/types'
import { toDateInputValue } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatCOP } from '../../lib/formatCOP'

interface BillPayPanelProps {
  bill: Bill
  accounts: Account[]
  onPaid: () => Promise<void> | void
  onClose: () => void
}

export function BillPayPanel({ bill, accounts, onPaid, onClose }: BillPayPanelProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [amount, setAmount] = useState(String(Number(bill.amount)))
  // oxlint-disable-next-line react/purity -- fecha por defecto al abrir el formulario
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await billsApi.pay(bill.id, { accountId, amount: Number(amount), date })
      await onPaid()
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo registrar el pago'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h2>Pagar {bill.name}</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Volver
        </button>
      </div>
      {error && <p className="alert">{error}</p>}

      <p className="muted small">
        Se creará un gasto{bill.category ? ` en ${bill.category.name}` : ''} por {formatCOP(amount || 0)}.
      </p>

      <label className="field">
        Cuenta
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
          <option value="">Selecciona…</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Monto (COP)
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      <label className="field">
        Fecha
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !accountId}>
          {saving ? 'Pagando…' : 'Registrar pago'}
        </button>
      </div>
    </form>
  )
}
