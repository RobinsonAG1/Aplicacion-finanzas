import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { TransactionType } from '../generated/prisma/enums.js';
import type { ListTransactionsQuery } from '../schemas/transaction.schema.js';

const categorySelect = { id: true, name: true, color: true, type: true } as const;
const accountSelect = { id: true, name: true, type: true, currency: true } as const;

export interface TransactionFilters {
  search?: string;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  from?: Date;
  to?: Date;
}

function buildWhere(userId: string, query: TransactionFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: 'insensitive' } },
      { merchant: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
  if (query.type) where.type = query.type;
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }
  return where;
}

function buildOrderBy(
  sort: ListTransactionsQuery['sort'],
  order: ListTransactionsQuery['order'],
): Prisma.TransactionOrderByWithRelationInput[] {
  const primary = { [sort]: order } as Prisma.TransactionOrderByWithRelationInput;
  return [primary, { id: 'desc' }];
}

export const transactionRepository = {
  async list(userId: string, query: ListTransactionsQuery) {
    const where = buildWhere(userId, query);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: buildOrderBy(query.sort, query.order),
        skip,
        take: query.limit,
        include: { category: { select: categorySelect }, account: { select: accountSelect } },
      }),
      prisma.transaction.count({ where }),
    ]);
    return { items, total };
  },

  findOwned(id: string, userId: string) {
    return prisma.transaction.findFirst({ where: { id, userId } });
  },

  findForExport(userId: string, filters: TransactionFilters) {
    return prisma.transaction.findMany({
      where: buildWhere(userId, filters),
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include: { category: { select: categorySelect }, account: { select: accountSelect } },
    });
  },

  findExistingKeys(userId: string, accountIds: string[]) {
    return prisma.transaction.findMany({
      where: { userId, accountId: { in: accountIds } },
      select: { accountId: true, date: true, amount: true, type: true, merchant: true },
    });
  },

  findById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      include: { category: { select: categorySelect }, account: { select: accountSelect } },
    });
  },

  findRecentByMerchant(userId: string, merchant: string, take: number) {
    return prisma.transaction.findMany({
      where: {
        userId,
        categoryId: { not: null },
        merchant: { contains: merchant, mode: 'insensitive' },
      },
      select: { categoryId: true },
      take,
    });
  },
};
