export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface ApiErrorBody {
  error: {
    message: string
    code?: string
    details?: unknown
  }
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'CASH' | 'INVESTMENT'
export type CategoryType = 'INCOME' | 'EXPENSE'
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'
export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type PotTransactionType = 'DEPOSIT' | 'WITHDRAW'
export type ReminderChannel = 'EMAIL' | 'LOG'
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  isCustom: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  accountId: string
  categoryId: string | null
  amount: string
  type: TransactionType
  description: string | null
  merchant: string | null
  date: string
  category: Category | null
  account: Pick<Account, 'id' | 'name' | 'type' | 'currency'> | null
}

export interface PageMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}
