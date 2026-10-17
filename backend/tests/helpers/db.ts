import { prisma } from '../../src/db/prisma.js';

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.billReminder.deleteMany(),
    prisma.recurringBill.deleteMany(),
    prisma.potTransaction.deleteMany(),
    prisma.pot.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.category.deleteMany(),
    prisma.account.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
