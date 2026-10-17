import { prisma } from '../db/prisma.js';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data: { email: string; name: string; passwordHash: string }) {
    return prisma.user.create({ data });
  },
};
