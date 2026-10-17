import { z } from 'zod';
import { CategoryType } from '../generated/prisma/enums.js';

export const categoryTypeSchema = z.enum(CategoryType);

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color hex invalido (ej. #16a34a)');

export const createCategoryBody = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(60),
  type: categoryTypeSchema,
  color: colorSchema.default('#64748b'),
});

export const updateCategoryBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: colorSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type CreateCategoryInput = z.infer<typeof createCategoryBody>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryBody>;
