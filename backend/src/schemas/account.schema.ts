import { z } from 'zod';
import { AccountType } from '../generated/prisma/enums.js';

export const accountTypeSchema = z.enum(AccountType);

const currencySchema = z.string().trim().toUpperCase().length(3, 'Moneda ISO de 3 letras');

export const createAccountBody = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(80),
  type: accountTypeSchema,
  balance: z.number().default(0),
  currency: currencySchema.default('COP'),
});

export const updateAccountBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: accountTypeSchema.optional(),
    balance: z.number().optional(),
    currency: currencySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type CreateAccountInput = z.infer<typeof createAccountBody>;
export type UpdateAccountInput = z.infer<typeof updateAccountBody>;
