import { prisma } from '../db/prisma.js';
import { PotTransactionType } from '../generated/prisma/enums.js';
import { AppError } from '../utils/AppError.js';
import { potRepository } from '../repositories/pot.repository.js';
import type {
  CreatePotInput,
  PotMovementInput,
  UpdatePotInput,
} from '../schemas/pot.schema.js';

interface PotLike {
  id: string;
  name: string;
  color: string;
  targetAmount: { toNumber: () => number };
  currentAmount: { toNumber: () => number };
  createdAt: Date;
  updatedAt: Date;
}

export interface PotSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: string;
  currentAmount: string;
  remaining: number;
  percentage: number;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function notFound(): AppError {
  return new AppError('Hucha no encontrada', 404, { code: 'POT_NOT_FOUND' });
}

function toSummary(pot: PotLike): PotSummary {
  const target = pot.targetAmount.toNumber();
  const current = pot.currentAmount.toNumber();
  return {
    id: pot.id,
    name: pot.name,
    color: pot.color,
    targetAmount: target.toFixed(2),
    currentAmount: current.toFixed(2),
    remaining: Number((target - current).toFixed(2)),
    percentage: target > 0 ? Number(((current / target) * 100).toFixed(1)) : 0,
    completed: current >= target,
    createdAt: pot.createdAt,
    updatedAt: pot.updatedAt,
  };
}

export const potService = {
  async list(userId: string) {
    const pots = await potRepository.listByUser(userId);
    return pots.map(toSummary);
  },

  async get(userId: string, id: string, limit: number) {
    const pot = await potRepository.findOwnedWithTransactions(id, userId, limit);
    if (!pot) throw notFound();
    return {
      ...toSummary(pot),
      transactions: pot.transactions.map((t) => ({
        id: t.id,
        amount: t.amount.toFixed(2),
        type: t.type,
        date: t.date,
        note: t.note,
      })),
    };
  },

  async create(userId: string, input: CreatePotInput) {
    const pot = await potRepository.create(userId, {
      name: input.name,
      targetAmount: input.targetAmount,
      ...(input.color ? { color: input.color } : {}),
    });
    return toSummary(pot);
  },

  async update(userId: string, id: string, input: UpdatePotInput) {
    const existing = await potRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    const pot = await potRepository.update(id, input);
    return toSummary(pot);
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await potRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    await potRepository.delete(id);
  },

  async deposit(userId: string, id: string, input: PotMovementInput) {
    const existing = await potRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    const pot = await prisma.$transaction(async (tx) => {
      await tx.potTransaction.create({
        data: {
          potId: id,
          amount: input.amount,
          type: PotTransactionType.DEPOSIT,
          note: input.note,
          ...(input.date ? { date: input.date } : {}),
        },
      });
      return tx.pot.update({
        where: { id },
        data: { currentAmount: { increment: input.amount } },
      });
    });
    return toSummary(pot);
  },

  async withdraw(userId: string, id: string, input: PotMovementInput) {
    const existing = await potRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    if (input.amount > existing.currentAmount.toNumber()) {
      throw new AppError('Saldo insuficiente en la hucha', 422, {
        code: 'POT_INSUFFICIENT_FUNDS',
      });
    }
    const pot = await prisma.$transaction(async (tx) => {
      await tx.potTransaction.create({
        data: {
          potId: id,
          amount: input.amount,
          type: PotTransactionType.WITHDRAW,
          note: input.note,
          ...(input.date ? { date: input.date } : {}),
        },
      });
      return tx.pot.update({
        where: { id },
        data: { currentAmount: { decrement: input.amount } },
      });
    });
    return toSummary(pot);
  },
};
