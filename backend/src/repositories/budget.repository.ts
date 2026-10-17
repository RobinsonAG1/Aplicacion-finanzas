import { prisma } from '../db/prisma.js';
import type { BudgetPeriod } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

const categorySelect = { id: true, name: true, color: true, type: true } as const;

export const budgetRepository = {
  listByUser(userId: string, period?: BudgetPeriod) {
    return prisma.budget.findMany({
      where: { userId, ...(period ? { period } : {}) },
      orderBy: { startDate: 'desc' },
      include: { category: { select: categorySelect } },
    });
  },
  findOwned(id: string, userId: string) {
    return prisma.budget.findFirst({
      where: { id, userId },
      include: { category: { select: categorySelect } },
    });
  },
  create(
    userId: string,
    data: {
      categoryId: string;
      limitAmount: number;
      period: BudgetPeriod;
      startDate: Date;
      endDate: Date | null;
    },
  ) {
    return prisma.budget.create({
      data: { ...data, userId },
      include: { category: { select: categorySelect } },
    });
  },
  update(id: string, data: Prisma.BudgetUpdateInput) {
    return prisma.budget.update({
      where: { id },
      data,
      include: { category: { select: categorySelect } },
    });
  },
  delete(id: string) {
    return prisma.budget.delete({ where: { id } });
  },
};
