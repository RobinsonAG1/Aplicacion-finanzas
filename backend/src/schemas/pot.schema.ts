import { z } from 'zod';

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe estar en formato hexadecimal (#RRGGBB)');

export const createPotBody = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(80),
  targetAmount: z.number().positive('La meta debe ser mayor a cero'),
  color: colorSchema.optional(),
});

export const updatePotBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    targetAmount: z.number().positive().optional(),
    color: colorSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const potMovementBody = z.object({
  amount: z.number().positive('El monto debe ser mayor a cero'),
  note: z.string().trim().max(140).optional(),
  date: z.coerce.date().optional(),
});

export const potTransactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePotInput = z.infer<typeof createPotBody>;
export type UpdatePotInput = z.infer<typeof updatePotBody>;
export type PotMovementInput = z.infer<typeof potMovementBody>;
