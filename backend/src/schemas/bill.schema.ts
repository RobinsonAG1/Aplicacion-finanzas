import { z } from 'zod';
import { ReminderChannel } from '../generated/prisma/enums.js';

export const createBillBody = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(80),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  categoryId: z.string().min(1).nullable().optional(),
  dueDay: z.number().int().min(1).max(31),
  isActive: z.boolean().default(true),
});

export const updateBillBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    amount: z.number().positive().optional(),
    categoryId: z.string().min(1).nullable().optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const listBillsQuery = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const upcomingQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const createReminderBody = z.object({
  dueDate: z.coerce.date().optional(),
  channel: z.enum(ReminderChannel).default('LOG'),
  send: z.boolean().default(false),
});

export const runRemindersBody = z.object({
  days: z.number().int().min(1).max(90).default(7),
  channel: z.enum(ReminderChannel).default('LOG'),
});

export const payBillBody = z.object({
  accountId: z.string().min(1, 'Cuenta obligatoria'),
  amount: z.number().positive().optional(),
  date: z.coerce.date().optional(),
});

export type CreateBillInput = z.infer<typeof createBillBody>;
export type UpdateBillInput = z.infer<typeof updateBillBody>;
export type CreateReminderInput = z.infer<typeof createReminderBody>;
export type RunRemindersInput = z.infer<typeof runRemindersBody>;
export type PayBillInput = z.infer<typeof payBillBody>;
