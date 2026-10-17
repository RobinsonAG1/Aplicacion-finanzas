import { AppError } from '../utils/AppError.js';
import { categoryRepository } from '../repositories/category.repository.js';
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';

function notFound(): AppError {
  return new AppError('Categoria no encontrada', 404, { code: 'CATEGORY_NOT_FOUND' });
}

async function ensureOwned(userId: string, id: string) {
  const category = await categoryRepository.findOwned(id, userId);
  if (!category) throw notFound();
  return category;
}

export const categoryService = {
  list(userId: string) {
    return categoryRepository.listByUser(userId);
  },

  async create(userId: string, input: CreateCategoryInput) {
    const existing = await categoryRepository.findByUnique(userId, input.name, input.type);
    if (existing) {
      throw new AppError('Ya existe una categoria con ese nombre y tipo', 409, {
        code: 'CATEGORY_EXISTS',
      });
    }
    return categoryRepository.create(userId, input);
  },

  get(userId: string, id: string) {
    return ensureOwned(userId, id);
  },

  async update(userId: string, id: string, input: UpdateCategoryInput) {
    const category = await ensureOwned(userId, id);
    if (input.name && input.name !== category.name) {
      const duplicate = await categoryRepository.findByUnique(userId, input.name, category.type);
      if (duplicate) {
        throw new AppError('Ya existe una categoria con ese nombre y tipo', 409, {
          code: 'CATEGORY_EXISTS',
        });
      }
    }
    return categoryRepository.update(id, input);
  },

  async remove(userId: string, id: string): Promise<void> {
    await ensureOwned(userId, id);
    await categoryRepository.delete(id);
  },
};
