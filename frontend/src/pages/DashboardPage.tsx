import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { billsApi } from '../api/bills'
import { budgetsApi } from '../api/budgets'
import { potsApi } from '../api/pots'
import { transactionsApi } from '../api/transactions'
import { useAuth } from '../features/auth/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatDate } from '../lib/dates'
import { formatCOP, formatPercent, formatSignedCOP } from '../lib/formatCOP'

export function DashboardPage() {
  const { user } = useAuth()

  const loadSummary = useCallback(() => analyticsApi.summary(), [])
  const loadUpcoming = useCallback(() => billsApi.upcoming(30), [])
  const loadBudgets = useCallback(() => budgetsApi.overview(), [])
  const loadPots = useCallback(() => potsApi.list(), [])
  const loadRecent = useCallback(
    () => transactionsApi.list({ limit: 5, sort: 'date', order: 'desc' }),
    [],
  )

  const summary = useAsyncData(loadSummary)
  const upcoming = useAsyncData(loadUpcoming)
  const budgets = useAsyncData(loadBudgets)
  const pots = useAsyncData(loadPots)
  const recent = useAsyncData(loadRecent)

  const totals = summary.data?.totals

  return (
    <section className="page">
      <h1>Hola, {user?.name}</h1>
      <p className="muted">Resumen de tu mes en pesos colombianos.</p>

      <div className="cards">
        <article className="card">
          <span className="card-label">Ingresos</span>
          <span className="card-value amount-income">{formatCOP(totals?.income ?? 0)}</span>
        </article>
        <article className="card">
          <span className="card-label">Gastos</span>
          <span className="card-value amount-expense">{formatCOP(totals?.expense ?? 0)}</span>
        </article>
        <article className="card">
          <span className="card-label">Balance neto</span>
          <span className="card-value">{formatCOP(totals?.net ?? 0)}</span>
        </article>
        <article className="card">
          <span className="card-label">Tasa de ahorro</span>
          <span className="card-value">{formatPercent(totals?.savingsRate ?? 0)}</span>
        </article>
      </div>

      <div className="charts">
        <div className="panel">
          <div className="panel-head">
            <h3 className="chart-title">Próximos vencimientos</h3>
            <Link to="/bills">Ver facturas</Link>
          </div>
          {upcoming.loading && <p className="muted small">Cargando…</p>}
          {upcoming.data && upcoming.data.upcoming.length === 0 && (
            <p className="muted small">Sin vencimientos en los próximos 30 días.</p>
          )}
          {upcoming.data && upcoming.data.upcoming.length > 0 && (
            <ul className="movement-list">
              {upcoming.data.upcoming.slice(0, 5).map((bill) => (
                <li key={bill.id} className="movement">
                  <span>{bill.name}</span>
                  <span className={`small ${bill.overdue ? 'amount-expense' : 'muted'}`}>
                    {bill.overdue ? 'Vencida' : formatDate(bill.dueDate)}
                  </span>
                  <span className="right">{formatCOP(bill.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="chart-title">Presupuestos del mes</h3>
            <Link to="/budgets">Ver todos</Link>
          </div>
          {budgets.loading && <p className="muted small">Cargando…</p>}
          {budgets.data && budgets.data.budgets.length === 0 && (
            <p className="muted small">Sin presupuestos definidos.</p>
          )}
          {budgets.data && budgets.data.budgets.length > 0 && (
            <>
              <p className="muted small">
                {formatCOP(budgets.data.totals.spent)} de{' '}
                {formatCOP(budgets.data.totals.limitAmount)}
              </p>
              <div className="budget-list">
                {budgets.data.budgets.slice(0, 4).map((budget) => (
                  <div key={budget.id}>
                    <div className="budget-head">
                      <span className="budget-cat">
                        <span
                          className="color-dot"
                          style={{ backgroundColor: budget.category.color }}
                        />
                        {budget.category.name}
                      </span>
                      <span className="muted small">{budget.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="progress">
                      <div
                        className={
                          budget.exceeded
                            ? 'progress-fill danger'
                            : budget.percentage >= 80
                              ? 'progress-fill warn'
                              : 'progress-fill'
                        }
                        style={{ width: `${Math.min(100, budget.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="chart-title">Huchas</h3>
            <Link to="/pots">Ver huchas</Link>
          </div>
          {pots.loading && <p className="muted small">Cargando…</p>}
          {pots.data && pots.data.length === 0 && (
            <p className="muted small">Sin huchas creadas.</p>
          )}
          {pots.data && pots.data.length > 0 && (
            <div className="budget-list">
              {pots.data.slice(0, 4).map((pot) => (
                <div key={pot.id}>
                  <div className="budget-head">
                    <span className="budget-cat">
                      <span className="color-dot" style={{ backgroundColor: pot.color }} />
                      {pot.name}
                    </span>
                    <span className="muted small">
                      {formatCOP(pot.currentAmount)} / {formatCOP(pot.targetAmount)}
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, pot.percentage)}%`, backgroundColor: pot.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="chart-title">Últimas transacciones</h3>
            <Link to="/transactions">Ver todas</Link>
          </div>
          {recent.loading && <p className="muted small">Cargando…</p>}
          {recent.data && recent.data.data.length === 0 && (
            <p className="muted small">Sin movimientos recientes.</p>
          )}
          {recent.data && recent.data.data.length > 0 && (
            <ul className="movement-list">
              {recent.data.data.map((transaction) => (
                <li key={transaction.id} className="movement">
                  <span>{formatDate(transaction.date)}</span>
                  <span className="muted small">{transaction.merchant ?? transaction.description ?? '—'}</span>
                  <span
                    className={transaction.type === 'INCOME' ? 'amount-income' : 'amount-expense'}
                  >
                    {formatSignedCOP(transaction.amount, transaction.type === 'INCOME')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
