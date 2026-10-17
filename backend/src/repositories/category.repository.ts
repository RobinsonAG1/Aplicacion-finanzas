import { prisma } from '../db/prisma.js';
import type { CategoryType } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

export const categoryRepository = {
  listByUser(userId: string, type?: CategoryType) {
    return prisma.category.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  },
  findOwned(id: string, userId: string) {
    return prisma.category.findFirst({ where: { id, userId } });
  },
  findByUnique(userId: string, name: string, type: CategoryType) {
    return prisma.category.findUnique({
      where: { userId_name_type: { userId, name, type } },
    });
  },
  create(userId: string, data: { name: string; type: CategoryType; color: string }) {
    return prisma.category.create({ data: { ...data, userId, isCustom: true } });
  },
  update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};
