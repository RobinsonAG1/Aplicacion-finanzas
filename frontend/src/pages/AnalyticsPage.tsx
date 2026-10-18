import { useCallback, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import type { CategorySpend } from '../api/analytics'
import { useTheme } from '../features/theme/useTheme'
import { useAsyncData } from '../hooks/useAsyncData'
import { CHART_PALETTES } from '../lib/chartPalette'
import { formatDate, formatMonthLabel } from '../lib/dates'
import { formatCOP, formatNumber, formatPercent } from '../lib/formatCOP'

const MONTH_OPTIONS = [3, 6, 12]

function monthRange(months: number): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  return { from: from.toISOString(), to: now.toISOString() }
}

function topCategories(categories: CategorySpend[], size = 6): CategorySpend[] {
  if (categories.length <= size) return categories
  const head = categories.slice(0, size)
  const rest = categories.slice(size)
  const others: CategorySpend = {
    id: 'others',
    name: 'Otros',
    color: '#64748b',
    total: rest.reduce((sum, item) => sum + item.total, 0),
    percentage: rest.reduce((sum, item) => sum + item.percentage, 0),
    rank: 0,
  }
  return [...head, others]
}

export function AnalyticsPage() {
  const [months, setMonths] = useState(6)
  const { resolvedTheme } = useTheme()
  const palette = CHART_PALETTES[resolvedTheme]
  const tooltipStyle = {
    background: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 8,
    color: palette.tooltipText,
  }

  const loadSummary = useCallback(() => {
    const { from, to } = monthRange(months)
    return analyticsApi.summary(from, to)
  }, [months])
  const loadMonthly = useCallback(() => analyticsApi.monthly(months), [months])
  const loadTrends = useCallback(() => analyticsApi.categoryTrends(months), [months])
  const loadTimeline = useCallback(() => {
    const { from, to } = monthRange(months)
    return analyticsApi.balanceTimeline(from, to, 500)
  }, [months])

  const summary = useAsyncData(loadSummary)
  const monthly = useAsyncData(loadMonthly)
  const trends = useAsyncData(loadTrends)
  const timeline = useAsyncData(loadTimeline)

  const totals = summary.data?.totals
  const pieData = topCategories(summary.data?.byCategory ?? [])
  const latestTrendMonth = (trends.data?.trends ?? []).reduce(
    (max, item) => (item.month > max ? item.month : max),
    '',
  )
  const topMovers = (trends.data?.trends ?? []).filter((item) => item.month === latestTrendMonth)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Analítica</h1>
          <p className="muted">Tendencias de ingresos, gastos y saldo.</p>
        </div>
        <select
          value={months}
          aria-label="Periodo"
          onChange={(event) => setMonths(Number(event.target.value))}
        >
          {MONTH_OPTIONS.map((value) => (
            <option key={value} value={value}>
              Últimos {value} meses
            </option>
          ))}
        </select>
      </div>

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
        <div className="panel chart-wide">
          <h3 className="chart-title">Ingresos vs. gastos por mes</h3>
          {monthly.loading && <p className="muted small">Cargando…</p>}
          {monthly.error && <p className="alert">{monthly.error}</p>}
          {monthly.data && monthly.data.months.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly.data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} stroke={palette.axis} />
                <YAxis
                  tickFormatter={(value) => formatNumber(value)}
                  stroke={palette.axis}
                  width={70}
                />
                <Tooltip
                  formatter={(value) => formatCOP(Number(value))}
                  labelFormatter={(label) => formatMonthLabel(String(label))}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  itemStyle={{ color: palette.tooltipText }}
                />
                <Legend wrapperStyle={{ color: palette.axis }} />
                <Bar dataKey="income" name="Ingresos" fill={palette.income} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Gastos" fill={palette.expense} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {monthly.data && monthly.data.months.length === 0 && (
            <p className="muted small">Sin datos para el periodo.</p>
          )}
        </div>

        <div className="panel">
          <h3 className="chart-title">Gasto por categoría</h3>
          {summary.loading && <p className="muted small">Cargando…</p>}
          {pieData.length === 0 && !summary.loading && (
            <p className="muted small">Sin gastos registrados.</p>
          )}
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                >
                  {pieData.map((item) => (
                    <Cell key={item.id} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCOP(Number(value))}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  itemStyle={{ color: palette.tooltipText }}
                />
                <Legend wrapperStyle={{ color: palette.axis }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel chart-wide">
          <h3 className="chart-title">Evolución del saldo</h3>
          {timeline.loading && <p className="muted small">Cargando…</p>}
          {timeline.error && <p className="alert">{timeline.error}</p>}
          {timeline.data && timeline.data.timeline.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timeline.data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(String(value))}
                  stroke={palette.axis}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(value) => formatNumber(value)}
                  stroke={palette.axis}
                  width={70}
                />
                <Tooltip
                  formatter={(value) => formatCOP(Number(value))}
                  labelFormatter={(label) => formatDate(String(label))}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  itemStyle={{ color: palette.tooltipText }}
                />
                <Line
                  type="monotone"
                  dataKey="runningBalance"
                  name="Saldo"
                  stroke={palette.line}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {timeline.data && timeline.data.timeline.length === 0 && (
            <p className="muted small">Sin movimientos en el periodo.</p>
          )}
        </div>

        <div className="panel chart-wide">
          <h3 className="chart-title">Variación por categoría (último mes)</h3>
          {topMovers.length === 0 && !trends.loading && (
            <p className="muted small">Sin datos suficientes.</p>
          )}
          {topMovers.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="right">Gasto</th>
                  <th className="right">Variación</th>
                </tr>
              </thead>
              <tbody>
                {topMovers.map((item) => (
                  <tr key={item.categoryId + item.month}>
                    <td>
                      <span className="category-cell">
                        <span className="color-dot" style={{ backgroundColor: item.color }} />
                        {item.categoryName}
                      </span>
                    </td>
                    <td className="right">{formatCOP(item.total)}</td>
                    <td className="right">
                      {item.changePct === null ? (
                        <span className="muted small">—</span>
                      ) : (
                        <span className={item.changePct <= 0 ? 'amount-income' : 'amount-expense'}>
                          {item.changePct > 0 ? '+' : ''}
                          {formatPercent(item.changePct)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
