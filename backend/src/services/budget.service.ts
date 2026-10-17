import { CategoryType } from '../generated/prisma/enums.js';
import { AppError } from '../utils/AppError.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { budgetRepository } from '../repositories/budget.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import type {
  BudgetOverviewQuery,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../schemas/budget.schema.js';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function notFound(): AppError {
  return new AppError('Presupuesto no encontrado', 404, { code: 'BUDGET_NOT_FOUND' });
}

export interface BudgetSummary {
  id: string;
  category: { id: string; name: string; color: string; type: string };
  limitAmount: string;
  period: string;
  startDate: Date;
  endDate: Date | null;
  spent: number;
  remaining: number;
  percentage: number;
  exceeded: boolean;
  window: { from: Date; to: Date } | null;
}

async function ensureExpenseCategory(userId: string, categoryId: string): Promise<void> {
  const category = await categoryRepository.findOwned(categoryId, userId);
  if (!category) {
    throw new AppError('Categoria no encontrada', 404, { code: 'CATEGORY_NOT_FOUND' });
  }
  if (category.type !== CategoryType.EXPENSE) {
    throw new AppError('Solo se presupuestan categorias de gasto', 422, {
      code: 'BUDGET_INVALID_CATEGORY',
    });
  }
}

function intersect(budget: { startDate: Date; endDate: Date | null }, from: Date, to: Date) {
  const start = budget.startDate > from ? budget.startDate : from;
  const end = budget.endDate && budget.endDate < to ? budget.endDate : to;
  if (end < start) return null;
  return { from: start, to: end };
}

export const budgetService = {
  async list(userId: string, period?: CreateBudgetInput['period']) {
    return budgetRepository.listByUser(userId, period);
  },

  async get(userId: string, id: string) {
    const budget = await budgetRepository.findOwned(id, userId);
    if (!budget) throw notFound();
    return budget;
  },

  async create(userId: string, input: CreateBudgetInput) {
    await ensureExpenseCategory(userId, input.categoryId);
    return budgetRepository.create(userId, {
      categoryId: input.categoryId,
      limitAmount: input.limitAmount,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    });
  },

  async update(userId: string, id: string, input: UpdateBudgetInput) {
    const existing = await budgetRepository.findOwned(id, userId);
    if (!existing) throw notFound();

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      await ensureExpenseCategory(userId, input.categoryId);
    }

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
    if (endDate && endDate < startDate) {
      throw new AppError('endDate debe ser posterior o igual a startDate', 422, {
        code: 'BUDGET_INVALID_RANGE',
      });
    }

    return budgetRepository.update(id, {
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      ...(input.limitAmount !== undefined ? { limitAmount: input.limitAmount } : {}),
      ...(input.period ? { period: input.period } : {}),
      startDate,
      endDate,
    });
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await budgetRepository.findOwned(id, userId);
    if (!existing) throw notFound();
    await budgetRepository.delete(id);
  },

  async overview(userId: string, query: BudgetOverviewQuery) {
    const now = new Date();
    const from = query.from ?? startOfMonth(now);
    const to = query.to ?? endOfDay(now);

    const budgets = await budgetRepository.listByUser(userId);
    const expenses = await transactionRepository.findExpensesInRange(userId, from, to);

    let totalLimit = 0;
    let totalSpent = 0;
    const summaries: BudgetSummary[] = budgets.map((budget) => {
      const window = intersect(budget, from, to);
      const limit = budget.limitAmount.toNumber();
      let spent = 0;
      if (window) {
        for (const expense of expenses) {
          if (
            expense.categoryId === budget.categoryId &&
            expense.date >= window.from &&
            expense.date <= window.to
          ) {
            spent += expense.amount.toNumber();
          }
        }
      }
      const remaining = limit - spent;
      const percentage = limit > 0 ? Number(((spent / limit) * 100).toFixed(1)) : 0;
      totalLimit += limit;
      totalSpent += spent;

      return {
        id: budget.id,
        category: budget.category,
        limitAmount: limit.toFixed(2),
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        spent: Number(spent.toFixed(2)),
        remaining: Number(remaining.toFixed(2)),
        percentage,
        exceeded: spent > limit,
        window,
      };
    });

    return {
      from,
      to,
      budgets: summaries,
      totals: {
        limitAmount: Number(totalLimit.toFixed(2)),
        spent: Number(totalSpent.toFixed(2)),
        remaining: Number((totalLimit - totalSpent).toFixed(2)),
      },
    };
  },
};
