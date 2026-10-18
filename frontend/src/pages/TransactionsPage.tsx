import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { accountsApi } from '../api/accounts'
import { categoriesApi } from '../api/categories'
import { transactionsApi } from '../api/transactions'
import type { ImportSummary, TransactionInput, TransactionQuery } from '../api/transactions'
import type { Transaction, TransactionType } from '../api/types'
import { Drawer } from '../components/Drawer'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { TransactionForm } from '../features/transactions/TransactionForm'
import { useAsyncData } from '../hooks/useAsyncData'
import { categoriesByType } from '../lib/categories'
import { formatDate } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { formatSignedCOP } from '../lib/formatCOP'
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPES } from '../lib/labels'

export function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState<'' | TransactionType>('')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<Transaction | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchTransactions = useCallback(() => {
    const query: TransactionQuery = { page, limit, sort: 'date', order }
    if (debouncedSearch.trim()) query.search = debouncedSearch.trim()
    if (accountId) query.accountId = accountId
    if (categoryId) query.categoryId = categoryId
    if (type) query.type = type
    return transactionsApi.list(query)
  }, [page, limit, debouncedSearch, accountId, categoryId, type, order])

  const { data: result, error, loading, reload } = useAsyncData(fetchTransactions)
  const loadAccounts = useCallback(() => accountsApi.list(), [])
  const { data: accounts } = useAsyncData(loadAccounts)
  const loadCategories = useCallback(() => categoriesApi.list(), [])
  const { data: categories } = useAsyncData(loadCategories)

  const transactions = result?.data ?? []
  const meta = result?.meta

  function resetFilters(): void {
    setSearch('')
    setAccountId('')
    setCategoryId('')
    setType('')
    setOrder('desc')
    setPage(1)
  }

  function openCreate(): void {
    setFormInitial(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(transaction: Transaction): void {
    setFormInitial(transaction)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm(): void {
    setFormOpen(false)
    setFormInitial(null)
  }

  async function handleFormSubmit(input: TransactionInput): Promise<void> {
    setSaving(true)
    setFormError(null)
    try {
      if (formInitial) {
        await transactionsApi.update(formInitial.id, input)
      } else {
        await transactionsApi.create(input)
        setPage(1)
      }
      closeForm()
      await reload()
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la transacción'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(transaction: Transaction): Promise<void> {
    const label = transaction.merchant ?? transaction.description ?? 'esta transacción'
    if (!window.confirm(`¿Eliminar ${label}? Se ajustará el saldo de la cuenta.`)) return
    setActionError(null)
    try {
      await transactionsApi.remove(transaction.id)
      if (formInitial?.id === transaction.id) closeForm()
      await reload()
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo eliminar la transacción'))
    }
  }

  async function handleCategorize(transaction: Transaction, value: string): Promise<void> {
    setActionError(null)
    try {
      await transactionsApi.setCategory(transaction.id, value || null)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo cambiar la categoría'))
    }
  }

  async function handleExport(): Promise<void> {
    setActionError(null)
    try {
      const query: TransactionQuery = {}
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim()
      if (accountId) query.accountId = accountId
      if (categoryId) query.categoryId = categoryId
      if (type) query.type = type
      const { blob, filename } = await transactionsApi.exportCsv(query)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo exportar el CSV'))
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setImportError(null)
    setImportSummary(null)
    try {
      const summary = await transactionsApi.importCsv(file)
      setImportSummary(summary)
      setPage(1)
      await reload()
    } catch (err) {
      setImportError(errorMessage(err, 'No se pudo importar el CSV'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Transacciones</h1>
          <p className="muted">Registra, filtra y categoriza tus movimientos.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => void handleExport()}>
            Exportar CSV
          </button>
          <label className="btn file-button">
            {importing ? 'Importando…' : 'Importar CSV'}
            <input type="file" accept=".csv,text/csv" onChange={(event) => void handleImport(event)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nueva transacción
          </button>
        </div>
      </div>

      {importSummary && (
        <p className="notice">
          Importación: {importSummary.imported} importadas, {importSummary.skipped} omitidas de{' '}
          {importSummary.total}.
          {importSummary.errors.length > 0 && ` ${importSummary.errors.length} con errores.`}
        </p>
      )}
      {importError && <p className="alert">{importError}</p>}
      {actionError && <p className="alert">{actionError}</p>}

      <div className="filters panel">
        <input
          type="search"
          className="filter-search"
          placeholder="Buscar por comercio o descripción…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <select
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value)
            setPage(1)
          }}
        >
          <option value="">Todas las cuentas</option>
          {(accounts ?? []).map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value)
            setPage(1)
          }}
        >
          <option value="">Todas las categorías</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value as '' | TransactionType)
            setPage(1)
          }}
        >
          <option value="">Todos los tipos</option>
          {TRANSACTION_TYPES.map((value) => (
            <option key={value} value={value}>
              {TRANSACTION_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          value={order}
          onChange={(event) => {
            setOrder(event.target.value as 'asc' | 'desc')
            setPage(1)
          }}
        >
          <option value="desc">Más recientes</option>
          <option value="asc">Más antiguas</option>
        </select>
        <select
          value={limit}
          aria-label="Por página"
          onChange={(event) => {
            setLimit(Number(event.target.value))
            setPage(1)
          }}
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" onClick={resetFilters}>
          Limpiar
        </button>
      </div>

      <div className="panel">
        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="alert">{error}</p>}
        {!loading && !error && transactions.length === 0 && (
          <p className="muted">No hay transacciones para los filtros seleccionados.</p>
        )}
        {transactions.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comercio</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th className="right">Monto</th>
                <th className="cell-actions">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.date)}</td>
                  <td>
                    <div>{transaction.merchant ?? '—'}</div>
                    {transaction.description && (
                      <div className="muted small">{transaction.description}</div>
                    )}
                  </td>
                  <td>
                    {transaction.type === 'TRANSFER' ? (
                      <span className="muted small">Transferencia</span>
                    ) : (
                      <span className="category-cell">
                        {transaction.category && (
                          <span
                            className="color-dot"
                            style={{ backgroundColor: transaction.category.color }}
                          />
                        )}
                        <select
                          aria-label="Categoría"
                          value={transaction.categoryId ?? ''}
                          onChange={(event) => void handleCategorize(transaction, event.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {categoriesByType(categories ?? [], transaction.type).map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    )}
                  </td>
                  <td>{transaction.account?.name ?? '—'}</td>
                  <td
                    className={
                      transaction.type === 'INCOME' ? 'right amount-income' : 'right amount-expense'
                    }
                  >
                    {formatSignedCOP(transaction.amount, transaction.type === 'INCOME')}
                  </td>
                  <td className="cell-actions">
                    <RowActionsMenu
                      label={`Acciones de ${
                        transaction.merchant ?? transaction.description ?? 'la transacción'
                      }`}
                      actions={[
                        { label: 'Editar', onSelect: () => openEdit(transaction) },
                        {
                          label: 'Eliminar',
                          onSelect: () => void handleDelete(transaction),
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

        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <span className="muted small">
              Página {meta.page} de {meta.totalPages} · {meta.total} movimientos
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <Drawer
        open={formOpen}
        onClose={closeForm}
        label={formInitial ? 'Editar transacción' : 'Nueva transacción'}
      >
        <TransactionForm
          key={formInitial?.id ?? 'new'}
          accounts={accounts ?? []}
          categories={categories ?? []}
          initial={formInitial}
          saving={saving}
          error={formError}
          onSubmit={(input) => void handleFormSubmit(input)}
          onCancel={closeForm}
        />
      </Drawer>
    </section>
  )
}
