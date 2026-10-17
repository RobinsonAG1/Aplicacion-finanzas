import { z } from 'zod';
import { BudgetPeriod } from '../generated/prisma/enums.js';

export const budgetPeriodSchema = z.enum(BudgetPeriod);

export const createBudgetBody = z
  .object({
    categoryId: z.string().min(1, 'Categoria obligatoria'),
    limitAmount: z.number().positive('El limite debe ser mayor a cero'),
    period: budgetPeriodSchema.default('MONTHLY'),
    startDate: z.coerce.date().default(() => new Date()),
    endDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'endDate debe ser posterior o igual a startDate',
    path: ['endDate'],
  });

export const updateBudgetBody = z
  .object({
    categoryId: z.string().min(1).optional(),
    limitAmount: z.number().positive().optional(),
    period: budgetPeriodSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'endDate debe ser posterior o igual a startDate',
    path: ['endDate'],
  });

export const listBudgetsQuery = z.object({
  period: budgetPeriodSchema.optional(),
});

export const budgetOverviewQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetBody>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetBody>;
export type BudgetOverviewQuery = z.infer<typeof budgetOverviewQuery>;
