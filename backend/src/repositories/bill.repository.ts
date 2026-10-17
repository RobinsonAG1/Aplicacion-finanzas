import { prisma } from '../db/prisma.js';
import type { ReminderChannel } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

const categorySelect = { id: true, name: true, color: true, type: true } as const;

const include = {
  category: { select: categorySelect },
  sourceTransaction: { select: { id: true, date: true, amount: true } },
} as const;

export const billRepository = {
  listByUser(userId: string, isActive?: boolean) {
    return prisma.recurringBill.findMany({
      where: { userId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { dueDay: 'asc' },
      include,
    });
  },
  findOwned(id: string, userId: string) {
    return prisma.recurringBill.findFirst({ where: { id, userId }, include });
  },
  create(
    userId: string,
    data: {
      name: string;
      amount: number;
      categoryId: string | null;
      dueDay: number;
      isActive: boolean;
    },
  ) {
    return prisma.recurringBill.create({ data: { ...data, userId }, include });
  },
  update(id: string, data: Prisma.RecurringBillUpdateInput) {
    return prisma.recurringBill.update({ where: { id }, data, include });
  },
  delete(id: string) {
    return prisma.recurringBill.delete({ where: { id } });
  },
  listReminders(billId: string) {
    return prisma.billReminder.findMany({ where: { billId }, orderBy: { dueDate: 'desc' } });
  },
  findReminder(billId: string, dueDate: Date) {
    return prisma.billReminder.findFirst({ where: { billId, dueDate } });
  },
  createReminder(data: {
    billId: string;
    dueDate: Date;
    channel: ReminderChannel;
    status: 'PENDING' | 'SENT' | 'FAILED';
    sentAt?: Date;
  }) {
    return prisma.billReminder.create({ data });
  },
  setSourceTransaction(id: string, transactionId: string) {
    return prisma.recurringBill.update({
      where: { id },
      data: { sourceTransactionId: transactionId },
      include,
    });
  },
};
