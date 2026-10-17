import type { AccountType, BudgetPeriod, CategoryType, TransactionType } from '../api/types'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Corriente',
  SAVINGS: 'Ahorros',
  CREDIT: 'Crédito',
  CASH: 'Efectivo',
  INVESTMENT: 'Inversión',
}

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
}

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
}

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]
export const CATEGORY_TYPES = Object.keys(CATEGORY_TYPE_LABELS) as CategoryType[]
export const BUDGET_PERIODS = Object.keys(BUDGET_PERIOD_LABELS) as BudgetPeriod[]
