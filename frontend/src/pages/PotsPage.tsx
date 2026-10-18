import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { potsApi } from '../api/pots'
import type { Pot, PotInput } from '../api/pots'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { PotMovePanel } from '../features/pots/PotMovePanel'
import { useAsyncData } from '../hooks/useAsyncData'
import { errorMessage } from '../lib/errors'
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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
    setSelectedPot(null)
    resetForm()
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
    setDrawerOpen(true)
  }

  function startMovement(pot: Pot, type: 'deposit' | 'withdraw'): void {
    setSelectedPot(pot)
    setMoveType(type)
    setMode('move')
    setDrawerOpen(true)
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
      closeDrawer()
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la hucha'))
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
      if (selectedPot?.id === pot.id) closeDrawer()
      await reload()
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo eliminar la hucha'))
    }
  }

  const drawerLabel =
    mode === 'move' && selectedPot
      ? `Mover en ${selectedPot.name}`
      : editing
        ? 'Editar hucha'
        : 'Nueva hucha'

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Huchas de ahorro</h1>
          <p className="muted">Aparta dinero hacia metas y sigue tu progreso.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Nueva hucha
        </button>
      </div>

      {actionError && <p className="alert">{actionError}</p>}

      <div className="panel panel-standalone">
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
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => startMovement(pot, 'deposit')}
                  >
                    Depositar
                  </button>
                  <RowActionsMenu
                    label={`Acciones de ${pot.name}`}
                    actions={[
                      { label: 'Retirar', onSelect: () => startMovement(pot, 'withdraw') },
                      { label: 'Editar', onSelect: () => startEdit(pot) },
                      {
                        label: 'Eliminar',
                        onSelect: () => void handleDelete(pot),
                        danger: true,
                      },
                    ]}
                  />
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} label={drawerLabel}>
        {mode === 'move' && selectedPot ? (
          <PotMovePanel
            key={selectedPot.id + moveType}
            pot={selectedPot}
            initialType={moveType}
            onChanged={async () => {
              await reload()
            }}
            onClose={closeDrawer}
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
