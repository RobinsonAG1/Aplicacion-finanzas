import { CategoryType, ReminderStatus, TransactionType } from '../generated/prisma/enums.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { billRepository } from '../repositories/bill.repository.js';
import { transactionService } from './transaction.service.js';
import type {
  CreateBillInput,
  CreateReminderInput,
  PayBillInput,
  RunRemindersInput,
  UpdateBillInput,
} from '../schemas/bill.schema.js';

interface BillRecord {
  id: string;
  name: string;
  amount: { toFixed: (n: number) => string };
  categoryId: string | null;
  dueDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; color: string; type: string } | null;
  sourceTransaction: { id: string; date: Date; amount: { toFixed: (n: number) => string } } | null;
}

function notFound(): AppError {
  return new AppError('Factura no encontrada', 404, { code: 'BILL_NOT_FOUND' });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampDueDate(year: number, month: number, dueDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

function billTiming(bill: BillRecord, today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const thisMonthDue = clampDueDate(year, month, bill.dueDay);
  const passedThisMonth = today > thisMonthDue;
  const nextDueDate = passedThisMonth ? clampDueDate(year, month + 1, bill.dueDay) : thisMonthDue;
  const paidThisMonth = Boolean(
    bill.sourceTransaction && startOfDay(bill.sourceTransaction.date) >= thisMonthDue,
  );
  const overdue = bill.isActive && passedThisMonth && !paidThisMonth;
  const dueDate = overdue ? thisMonthDue : nextDueDate;
  const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
  return { dueDate, nextDueDate, daysUntil, overdue };
}

function toBillView(bill: BillRecord, today: Date) {
  const timing = billTiming(bill, today);
  return {
    id: bill.id,
    name: bill.name,
    amount: bill.amount.toFixed(2),
    dueDay: bill.dueDay,
    isActive: bill.isActive,
    category: bill.category,
    sourceTransaction: bill.sourceTransaction
      ? {
          id: bill.sourceTransaction.id,
          date: bill.sourceTransaction.date,
          amount: bill.sourceTransaction.amount.toFixed(2),
        }
      : null,
    nextDueDate: timing.nextDueDate,
    daysUntil: timing.daysUntil,
    overdue: timing.overdue,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

async function ensureExpenseCategory(userId: string, categoryId: string): Promise<void> {
  const category = await categoryRepository.findOwned(categoryId, userId);
  if (!category) {
    throw new AppError('Categoria no encontrada', 404, { code: 'CATEGORY_NOT_FOUND' });
  }
  if (category.type !== CategoryType.EXPENSE) {
    throw new AppError('Solo se asignan categorias de gasto a las facturas', 422, {
      code: 'BILL_INVALID_CATEGORY',
    });
  }
}

export const billService = {
  async list(userId: string, isActive?: boolean) {
    const today = startOfDay(new Date());
    const bills = await billRepository.listByUser(userId, isActive);
    return bills.map((bill) => toBillView(bill as BillRecord, today));
  },

  async get(userId: string, id: string) {
    const bill = await billRepository.findOwned(id, userId);
    if (!bill) throw notFound();
    return toBillView(bill as BillRecord, startOfDay(new Date()));
  },

  async create(userId: string, input: CreateBillInput) {
    if (input.categoryId) await ensureExpenseCategory(userId, input.categoryId);
    const bill = await billRepository.create(userId, {
      name: input.name,
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      dueDay: input.dueDay,
      isActive: input.isActive,
    });
    return toBillView(bill as BillRecord, startOfDay(new Date()));
  },

  async update(userId: string, id: string, input: UpdateBillInput) {
    const existing = await billRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    if (input.categoryId) await ensureExpenseCategory(userId, input.categoryId);
    const bill = await billRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.dueDay !== undefined ? { dueDay: input.dueDay } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.categoryId !== undefined
        ? { category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true } }
        : {}),
    });
    return toBillView(bill as BillRecord, startOfDay(new Date()));
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await billRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    await billRepository.delete(id);
  },

  async upcoming(userId: string, days: number) {
    const today = startOfDay(new Date());
    const bills = await billRepository.listByUser(userId, true);
    const upcoming = bills
      .map((bill) => {
        const timing = billTiming(bill as BillRecord, today);
        return { bill: bill as BillRecord, timing };
      })
      .filter(({ timing }) => timing.overdue || timing.daysUntil <= days)
      .map(({ bill, timing }) => ({
        id: bill.id,
        name: bill.name,
        amount: bill.amount.toFixed(2),
        category: bill.category,
        dueDate: timing.dueDate,
        daysUntil: timing.daysUntil,
        overdue: timing.overdue,
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return { days, upcoming };
  },

  async listReminders(userId: string, billId: string) {
    const bill = await billRepository.findOwned(billId, userId);
    if (!bill) throw notFound();
    return billRepository.listReminders(billId);
  },

  async createReminder(userId: string, billId: string, input: CreateReminderInput) {
    const bill = await billRepository.findOwned(billId, userId);
    if (!bill) throw notFound();
    const today = startOfDay(new Date());
    const dueDate = input.dueDate
      ? startOfDay(input.dueDate)
      : billTiming(bill as BillRecord, today).dueDate;

    const existing = await billRepository.findReminder(billId, dueDate);
    if (existing) {
      throw new AppError('Ya existe un recordatorio para esa fecha', 409, {
        code: 'REMINDER_EXISTS',
      });
    }

    const reminder = await billRepository.createReminder({
      billId,
      dueDate,
      channel: input.channel,
      status: input.send ? ReminderStatus.SENT : ReminderStatus.PENDING,
      ...(input.send ? { sentAt: new Date() } : {}),
    });
    if (input.send) {
      logger.info(
        { billId, dueDate, channel: input.channel, stub: true },
        'Recordatorio de factura enviado (stub)',
      );
    }
    return reminder;
  },

  async runReminders(userId: string, input: RunRemindersInput) {
    const today = startOfDay(new Date());
    const bills = await billRepository.listByUser(userId, true);
    const created: unknown[] = [];
    let skipped = 0;

    for (const bill of bills) {
      const { dueDate, daysUntil, overdue } = billTiming(bill as BillRecord, today);
      if (!overdue && daysUntil > input.days) continue;
      if (await billRepository.findReminder(bill.id, dueDate)) {
        skipped += 1;
        continue;
      }
      const reminder = await billRepository.createReminder({
        billId: bill.id,
        dueDate,
        channel: input.channel,
        status: ReminderStatus.SENT,
        sentAt: new Date(),
      });
      logger.info(
        { billId: bill.id, dueDate, channel: input.channel, stub: true },
        'Recordatorio de factura generado y enviado (stub)',
      );
      created.push(reminder);
    }

    return { created: created.length, skipped, reminders: created };
  },

  async pay(userId: string, billId: string, input: PayBillInput) {
    const bill = await billRepository.findOwned(billId, userId);
    if (!bill) throw notFound();
    const transaction = await transactionService.create(userId, {
      accountId: input.accountId,
      categoryId: bill.categoryId,
      amount: input.amount ?? bill.amount.toNumber(),
      type: TransactionType.EXPENSE,
      description: `Pago ${bill.name}`,
      merchant: bill.name,
      date: input.date ?? new Date(),
    });
    const updated = await billRepository.setSourceTransaction(billId, transaction.id);
    return { bill: toBillView(updated as BillRecord, startOfDay(new Date())), transaction };
  },
};
