import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { potsApi } from '../../api/pots'
import type { Pot } from '../../api/pots'
import { useAsyncData } from '../../hooks/useAsyncData'
import { formatDate } from '../../lib/dates'
import { formatCOP } from '../../lib/formatCOP'

type MovementType = 'deposit' | 'withdraw'

interface PotMovePanelProps {
  pot: Pot
  initialType: MovementType
  onChanged: () => Promise<void> | void
  onClose: () => void
}

export function PotMovePanel({ pot, initialType, onChanged, onClose }: PotMovePanelProps) {
  const [type, setType] = useState<MovementType>(initialType)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadDetail = useCallback(() => potsApi.get(pot.id, 10), [pot.id])
  const { data: detail, reload } = useAsyncData(loadDetail)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const input = { amount: Number(amount), ...(note.trim() ? { note: note.trim() } : {}) }
      if (type === 'deposit') {
        await potsApi.deposit(pot.id, input)
      } else {
        await potsApi.withdraw(pot.id, input)
      }
      setAmount('')
      setNote('')
      await reload()
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel form-panel">
      <div className="panel-head">
        <h2>Mover en {pot.name}</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Volver
        </button>
      </div>
      {error && <p className="alert">{error}</p>}

      <div className="switch">
        <button
          type="button"
          className={`btn btn-sm ${type === 'deposit' ? 'btn-primary' : ''}`}
          onClick={() => setType('deposit')}
        >
          Depositar
        </button>
        <button
          type="button"
          className={`btn btn-sm ${type === 'withdraw' ? 'btn-primary' : ''}`}
          onClick={() => setType('withdraw')}
        >
          Retirar
        </button>
      </div>

      <form className="form-panel" onSubmit={handleSubmit}>
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
          Nota (opcional)
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={140}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : type === 'deposit' ? 'Depositar' : 'Retirar'}
          </button>
        </div>
      </form>

      <div className="muted small">
        Saldo actual: {formatCOP(pot.currentAmount)} de {formatCOP(pot.targetAmount)}
      </div>

      <h3 className="subheading">Movimientos recientes</h3>
      {detail && detail.transactions.length === 0 && (
        <p className="muted small">Sin movimientos todavía.</p>
      )}
      {detail && detail.transactions.length > 0 && (
        <ul className="movement-list">
          {detail.transactions.map((movement) => (
            <li key={movement.id} className="movement">
              <span>{formatDate(movement.date)}</span>
              <span className="muted small">{movement.note ?? '—'}</span>
              <span className={movement.type === 'DEPOSIT' ? 'amount-income' : 'amount-expense'}>
                {movement.type === 'DEPOSIT' ? '+' : '−'}
                {formatCOP(movement.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
