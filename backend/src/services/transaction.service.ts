import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TransactionType } from '../generated/prisma/enums.js';
import { AppError } from '../utils/AppError.js';
import { accountRepository } from '../repositories/account.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from '../schemas/transaction.schema.js';

const include = {
  category: { select: { id: true, name: true, color: true, type: true } },
  account: { select: { id: true, name: true, type: true, currency: true } },
} as const;

type Client = Prisma.TransactionClient;

function notFound(): AppError {
  return new AppError('Transaccion no encontrada', 404, { code: 'TRANSACTION_NOT_FOUND' });
}

function signedAmount(type: TransactionType, amount: number): number {
  return type === TransactionType.INCOME ? amount : -amount;
}

async function applyBalance(client: Client, accountId: string, signed: number): Promise<void> {
  if (signed === 0) return;
  await client.account.update({
    where: { id: accountId },
    data: { balance: signed > 0 ? { increment: signed } : { decrement: -signed } },
  });
}

async function ensureAccount(userId: string, accountId: string): Promise<void> {
  const account = await accountRepository.findOwned(accountId, userId);
  if (!account) throw new AppError('Cuenta no encontrada', 404, { code: 'ACCOUNT_NOT_FOUND' });
}

async function ensureCategory(userId: string, categoryId: string): Promise<void> {
  const category = await categoryRepository.findOwned(categoryId, userId);
  if (!category) {
    throw new AppError('Categoria no encontrada', 404, { code: 'CATEGORY_NOT_FOUND' });
  }
}

export interface Suggestion {
  category: { id: string; name: string; color: string; type: string };
  count: number;
  confidence: number;
}

export const transactionService = {
  async list(userId: string, query: ListTransactionsQuery) {
    const { items, total } = await transactionRepository.list(userId, query);
    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(userId: string, id: string) {
    const transaction = await transactionRepository.findOwned(id, userId);
    if (!transaction) throw notFound();
    return transactionRepository.findById(id);
  },

  async create(userId: string, input: CreateTransactionInput) {
    await ensureAccount(userId, input.accountId);
    if (input.categoryId) await ensureCategory(userId, input.categoryId);

    return prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          amount: input.amount,
          type: input.type,
          description: input.description,
          merchant: input.merchant,
          date: input.date,
        },
        include,
      });
      await applyBalance(tx, input.accountId, signedAmount(input.type, input.amount));
      return created;
    });
  },

  async update(userId: string, id: string, input: UpdateTransactionInput) {
    const existing = await transactionRepository.findOwned(id, userId);
    if (!existing) throw notFound();

    const targetAccountId = input.accountId ?? existing.accountId;
    const targetCategoryId =
      input.categoryId === undefined ? existing.categoryId : input.categoryId;
    if (input.accountId && input.accountId !== existing.accountId) {
      await ensureAccount(userId, input.accountId);
    }
    if (input.categoryId) await ensureCategory(userId, input.categoryId);

    const newAmount = input.amount ?? existing.amount.toNumber();
    const newType = input.type ?? existing.type;

    return prisma.$transaction(async (tx) => {
      await applyBalance(tx, existing.accountId, -signedAmount(existing.type, existing.amount.toNumber()));
      await applyBalance(tx, targetAccountId, signedAmount(newType, newAmount));
      return tx.transaction.update({
        where: { id },
        data: {
          accountId: targetAccountId,
          categoryId: targetCategoryId,
          amount: newAmount,
          type: newType,
          description: input.description ?? existing.description,
          merchant: input.merchant ?? existing.merchant,
          date: input.date ?? existing.date,
        },
        include,
      });
    });
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await transactionRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    await prisma.$transaction(async (tx) => {
      await applyBalance(tx, existing.accountId, -signedAmount(existing.type, existing.amount.toNumber()));
      await tx.transaction.delete({ where: { id } });
    });
  },

  async setCategory(userId: string, id: string, categoryId: string | null) {
    const existing = await transactionRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    if (categoryId) await ensureCategory(userId, categoryId);
    return prisma.transaction.update({ where: { id }, data: { categoryId }, include });
  },

  async suggestions(userId: string, merchant: string): Promise<{ suggestions: Suggestion[] }> {
    const rows = await transactionRepository.findRecentByMerchant(userId, merchant, 500);
    const total = rows.length;
    if (total === 0) return { suggestions: [] };

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.categoryId) continue;
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    }

    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const categories = await prisma.category.findMany({
      where: { userId, id: { in: top.map(([categoryId]) => categoryId) } },
      select: { id: true, name: true, color: true, type: true },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));

    const suggestions: Suggestion[] = [];
    for (const [categoryId, count] of top) {
      const category = byId.get(categoryId);
      if (category) {
        suggestions.push({ category, count, confidence: Number((count / total).toFixed(2)) });
      }
    }
    return { suggestions };
  },
};
