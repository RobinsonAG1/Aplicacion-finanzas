import { z } from 'zod';
import { TransactionType } from '../generated/prisma/enums.js';

export const transactionTypeSchema = z.enum(TransactionType);

export const createTransactionBody = z.object({
  accountId: z.string().min(1, 'Cuenta obligatoria'),
  categoryId: z.string().min(1).nullable().optional(),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  type: transactionTypeSchema,
  description: z.string().trim().max(200).optional(),
  merchant: z.string().trim().max(120).optional(),
  date: z.coerce.date(),
});

export const updateTransactionBody = z
  .object({
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    amount: z.number().positive().optional(),
    type: transactionTypeSchema.optional(),
    description: z.string().trim().max(200).optional(),
    merchant: z.string().trim().max(120).optional(),
    date: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const setCategoryBody = z.object({
  categoryId: z.string().min(1).nullable(),
});

export const listTransactionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['date', 'amount', 'createdAt']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  categoryId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  type: transactionTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const suggestionsQuery = z.object({
  merchant: z.string().trim().min(1).max(120),
});

export type CreateTransactionInput = z.infer<typeof createTransactionBody>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionBody>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuery>;
