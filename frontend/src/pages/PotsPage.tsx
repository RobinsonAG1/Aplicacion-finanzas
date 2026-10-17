import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { potsApi } from '../api/pots'
import type { Pot, PotInput } from '../api/pots'
import { PotMovePanel } from '../features/pots/PotMovePanel'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCOP } from '../lib/formatCOP'

interface FormState {
  id?: string
  name: string
  targetAmount: string
  color: string
}

const EMPTY_FORM: FormState = { name: '', targetAmount: '', color: '#22c55e' }

type PanelMode = 'form' | 'move'

export function PotsPage() {
  const loadPots = useCallback(() => potsApi.list(), [])
  const { data: pots, error, loading, reload } = useAsyncData(loadPots)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mode, setMode] = useState<PanelMode>('form')
  const [selectedPot, setSelectedPot] = useState<Pot | null>(null)
  const [moveType, setMoveType] = useState<'deposit' | 'withdraw'>('deposit')

  const editing = Boolean(form.id)

  function resetForm(): void {
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function startEdit(pot: Pot): void {
    setForm({
      id: pot.id,
      name: pot.name,
      targetAmount: String(Number(pot.targetAmount)),
      color: pot.color,
    })
    setFormError(null)
    setMode('form')
  }

  function startMovement(pot: Pot, type: 'deposit' | 'withdraw'): void {
    setSelectedPot(pot)
    setMoveType(type)
    setMode('move')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload: PotInput = {
        name: form.name,
        targetAmount: Number(form.targetAmount),
        color: form.color,
      }
      if (form.id) {
        await potsApi.update(form.id, payload)
      } else {
        await potsApi.create(payload)
      }
      resetForm()
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la hucha')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pot: Pot): Promise<void> {
    if (!window.confirm(`¿Eliminar la hucha "${pot.name}"? Se borrará su historial.`)) return
    setActionError(null)
    try {
      await potsApi.remove(pot.id)
      if (form.id === pot.id) resetForm()
      if (selectedPot?.id === pot.id) setMode('form')
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar la hucha')
    }
  }

  return (
    <section className="page">
      <h1>Huchas de ahorro</h1>
      <p className="muted">Aparta dinero hacia metas y sigue tu progreso.</p>

      {actionError && <p className="alert">{actionError}</p>}

      <div className="split">
        <div className="panel">
          {loading && <p className="muted">Cargando…</p>}
          {error && <p className="alert">{error}</p>}
          {!loading && !error && (pots ?? []).length === 0 && (
            <p className="muted">Aún no tienes huchas. Crea la primera.</p>
          )}
          <div className="budget-list">
            {(pots ?? []).map((pot) => (
              <article key={pot.id} className="budget-card">
                <div className="budget-head">
                  <span className="budget-cat">
                    <span className="color-dot" style={{ backgroundColor: pot.color }} />
                    {pot.name}
                    {pot.completed && <span className="badge">Meta alcanzada</span>}
                  </span>
                  <span className="budget-amounts">
                    {formatCOP(pot.currentAmount)} / {formatCOP(pot.targetAmount)}
                  </span>
                </div>
                <div className="progress">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, pot.percentage)}%`,
                      backgroundColor: pot.color,
                    }}
                  />
                </div>
                <div className="budget-foot">
                  <span className="muted small">
                    {pot.completed
                      ? `Superada por ${formatCOP(Math.abs(pot.remaining))}`
                      : `Faltan ${formatCOP(pot.remaining)}`}
                  </span>
                  <span className="muted small">{pot.percentage.toFixed(1)}%</span>
                  <span className="actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => startMovement(pot, 'deposit')}
                    >
                      Depositar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => startMovement(pot, 'withdraw')}
                    >
                      Retirar
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => startEdit(pot)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => void handleDelete(pot)}
                    >
                      Eliminar
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {mode === 'move' && selectedPot ? (
          <PotMovePanel
            key={selectedPot.id + moveType}
            pot={selectedPot}
            initialType={moveType}
            onChanged={async () => {
              await reload()
            }}
            onClose={() => setMode('form')}
          />
        ) : (
          <form className="panel form-panel" onSubmit={handleSubmit}>
            <h2>{editing ? 'Editar hucha' : 'Nueva hucha'}</h2>
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
              Meta (COP)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.targetAmount}
                onChange={(event) => setForm({ ...form, targetAmount: event.target.value })}
                required
              />
            </label>
            <label className="field">
              Color
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear hucha'}
              </button>
              {editing && (
                <button type="button" className="btn" onClick={resetForm}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
