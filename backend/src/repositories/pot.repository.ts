import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

export const potRepository = {
  listByUser(userId: string) {
    return prisma.pot.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  },
  findOwned(id: string, userId: string) {
    return prisma.pot.findFirst({ where: { id, userId } });
  },
  findOwnedWithTransactions(id: string, userId: string, take: number) {
    return prisma.pot.findFirst({
      where: { id, userId },
      include: { transactions: { orderBy: { date: 'desc' }, take } },
    });
  },
  create(
    userId: string,
    data: { name: string; targetAmount: number; color?: string },
  ) {
    return prisma.pot.create({ data: { ...data, userId } });
  },
  update(id: string, data: Prisma.PotUpdateInput) {
    return prisma.pot.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.pot.delete({ where: { id } });
  },
};
