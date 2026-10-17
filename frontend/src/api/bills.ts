import { apiRequest } from './client'
import type { ReminderChannel, ReminderStatus, Transaction } from './types'

export interface BillCategory {
  id: string
  name: string
  color: string
  type: string
}

export interface BillSourceTransaction {
  id: string
  date: string
  amount: string
}

export interface Bill {
  id: string
  name: string
  amount: string
  dueDay: number
  isActive: boolean
  category: BillCategory | null
  sourceTransaction: BillSourceTransaction | null
  nextDueDate: string
  daysUntil: number
  overdue: boolean
  createdAt: string
  updatedAt: string
}

export interface BillInput {
  name: string
  amount: number
  categoryId?: string | null
  dueDay: number
  isActive: boolean
}

export interface UpcomingBill {
  id: string
  name: string
  amount: string
  category: BillCategory | null
  dueDate: string
  daysUntil: number
  overdue: boolean
}

export interface UpcomingResult {
  days: number
  upcoming: UpcomingBill[]
}

export interface Reminder {
  id: string
  billId: string
  dueDate: string
  channel: ReminderChannel
  status: ReminderStatus
  sentAt: string | null
  createdAt: string
}

export interface ReminderInput {
  dueDate?: string
  channel?: ReminderChannel
  send?: boolean
}

export interface RunRemindersResult {
  created: number
  skipped: number
  reminders: Reminder[]
}

export interface PayBillInput {
  accountId: string
  amount?: number
  date?: string
}

export interface PayResult {
  bill: Bill
  transaction: Transaction
}

export const billsApi = {
  async list(isActive?: boolean): Promise<Bill[]> {
    const query = isActive === undefined ? '' : `?isActive=${isActive}`
    const result = await apiRequest<{ data: Bill[] }>(`/bills${query}`)
    return result.data
  },
  async upcoming(days?: number): Promise<UpcomingResult> {
    const query = days ? `?days=${days}` : ''
    const result = await apiRequest<{ data: UpcomingResult }>(`/bills/upcoming${query}`)
    return result.data
  },
  async create(input: BillInput): Promise<Bill> {
    const result = await apiRequest<{ data: Bill }>('/bills', { method: 'POST', body: input })
    return result.data
  },
  async update(id: string, input: Partial<BillInput>): Promise<Bill> {
    const result = await apiRequest<{ data: Bill }>(`/bills/${id}`, { method: 'PUT', body: input })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/bills/${id}`, { method: 'DELETE' })
  },
  async listReminders(id: string): Promise<Reminder[]> {
    const result = await apiRequest<{ data: Reminder[] }>(`/bills/${id}/reminders`)
    return result.data
  },
  async createReminder(id: string, input: ReminderInput = {}): Promise<Reminder> {
    const result = await apiRequest<{ data: Reminder }>(`/bills/${id}/reminders`, {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async runReminders(input: { days?: number; channel?: ReminderChannel } = {}): Promise<RunRemindersResult> {
    const result = await apiRequest<{ data: RunRemindersResult }>('/bills/reminders/run', {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async pay(id: string, input: PayBillInput): Promise<PayResult> {
    const result = await apiRequest<{ data: PayResult }>(`/bills/${id}/pay`, {
      method: 'POST',
      body: input,
    })
    return result.data
  },
}
