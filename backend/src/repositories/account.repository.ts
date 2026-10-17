import { prisma } from '../db/prisma.js';
import type { AccountType } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

export const accountRepository = {
  listByUser(userId: string) {
    return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  },
  findOwned(id: string, userId: string) {
    return prisma.account.findFirst({ where: { id, userId } });
  },
  create(
    userId: string,
    data: { name: string; type: AccountType; balance: number; currency: string },
  ) {
    return prisma.account.create({ data: { ...data, userId } });
  },
  update(id: string, data: Prisma.AccountUpdateInput) {
    return prisma.account.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.account.delete({ where: { id } });
  },
  countTransactions(accountId: string) {
    return prisma.transaction.count({ where: { accountId } });
  },
};
