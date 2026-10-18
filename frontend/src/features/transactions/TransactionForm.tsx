import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { transactionsApi } from '../../api/transactions'
import type { Suggestion, TransactionInput } from '../../api/transactions'
import type { Account, Category, Transaction, TransactionType } from '../../api/types'
import { categoriesByType } from '../../lib/categories'
import { toDateInputValue } from '../../lib/dates'
import { TRANSACTION_TYPE_LABELS } from '../../lib/labels'

const TRANSACTION_TYPES: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER']

interface TransactionFormProps {
  accounts: Account[]
  categories: Category[]
  initial?: Transaction | null
  saving: boolean
  error: string | null
  onSubmit: (input: TransactionInput) => void
  onCancel: () => void
}

export function TransactionForm({
  accounts,
  categories,
  initial,
  saving,
  error,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'EXPENSE')
  const [amount, setAmount] = useState(initial ? String(Number(initial.amount)) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [merchant, setMerchant] = useState(initial?.merchant ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  // oxlint-disable-next-line react/purity -- fecha por defecto al abrir el formulario
  const [date, setDate] = useState(toDateInputValue(initial?.date ?? new Date()))
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    const term = merchant.trim()
    const timer = setTimeout(() => {
      if (term.length < 3) {
        setSuggestions([])
        return
      }
      transactionsApi
        .suggestions(term)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
    }, 400)
    return () => clearTimeout(timer)
  }, [merchant])

  const availableCategories = categoriesByType(categories, type)

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit({
      accountId,
      categoryId: categoryId || null,
      amount: Number(amount),
      type,
      ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      date,
    })
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <h2>{initial ? 'Editar transacción' : 'Nueva transacción'}</h2>
      {error && <p className="alert">{error}</p>}

      <label className="field">
        Tipo
        <select value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
          {TRANSACTION_TYPES.map((value) => (
            <option key={value} value={value}>
              {TRANSACTION_TYPE_LABELS[value]}
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
        Fecha
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>

      <label className="field">
        Comercio
        <input
          type="text"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          maxLength={120}
          placeholder="Ej. Uber"
        />
      </label>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <span className="small muted">Sugerencias:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.category.id}
              type="button"
              className="chip"
              onClick={() => setCategoryId(suggestion.category.id)}
            >
              <span className="color-dot" style={{ backgroundColor: suggestion.category.color }} />
              {suggestion.category.name}
              <span className="muted small"> {Math.round(suggestion.confidence * 100)}%</span>
            </button>
          ))}
        </div>
      )}

      <label className="field">
        Categoría
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Sin categoría</option>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Descripción
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={200}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !accountId}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Registrar'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
