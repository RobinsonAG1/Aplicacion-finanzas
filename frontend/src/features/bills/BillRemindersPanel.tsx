import { useCallback, useState } from 'react'
import { billsApi } from '../../api/bills'
import type { Bill } from '../../api/bills'
import { useAsyncData } from '../../hooks/useAsyncData'
import { formatDate, toDateInputValue } from '../../lib/dates'

interface BillRemindersPanelProps {
  bill: Bill
  onClose: () => void
}

export function BillRemindersPanel({ bill, onClose }: BillRemindersPanelProps) {
  const loadReminders = useCallback(() => billsApi.listReminders(bill.id), [bill.id])
  const { data: reminders, loading, reload } = useAsyncData(loadReminders)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await billsApi.createReminder(bill.id, {
        dueDate: toDateInputValue(bill.nextDueDate),
        channel: 'LOG',
        send: true,
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el recordatorio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel form-panel">
      <div className="panel-head">
        <h2>Recordatorios · {bill.name}</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Volver
        </button>
      </div>
      {error && <p className="alert">{error}</p>}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleCreate()}
          disabled={saving}
        >
          {saving ? 'Creando…' : 'Crear recordatorio (envío LOG)'}
        </button>
      </div>

      {loading && <p className="muted small">Cargando…</p>}
      {reminders && reminders.length === 0 && (
        <p className="muted small">Sin recordatorios para esta factura.</p>
      )}
      {reminders && reminders.length > 0 && (
        <ul className="movement-list">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="movement">
              <span>{formatDate(reminder.dueDate)}</span>
              <span className="muted small">{reminder.channel}</span>
              <span className="badge">{reminder.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
