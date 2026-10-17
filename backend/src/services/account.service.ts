import { AppError } from '../utils/AppError.js';
import { accountRepository } from '../repositories/account.repository.js';
import type { CreateAccountInput, UpdateAccountInput } from '../schemas/account.schema.js';

function notFound(): AppError {
  return new AppError('Cuenta no encontrada', 404, { code: 'ACCOUNT_NOT_FOUND' });
}

async function ensureOwned(userId: string, id: string) {
  const account = await accountRepository.findOwned(id, userId);
  if (!account) throw notFound();
  return account;
}

export const accountService = {
  list(userId: string) {
    return accountRepository.listByUser(userId);
  },

  create(userId: string, input: CreateAccountInput) {
    return accountRepository.create(userId, input);
  },

  get(userId: string, id: string) {
    return ensureOwned(userId, id);
  },

  async update(userId: string, id: string, input: UpdateAccountInput) {
    await ensureOwned(userId, id);
    return accountRepository.update(id, input);
  },

  async remove(userId: string, id: string): Promise<void> {
    await ensureOwned(userId, id);
    await accountRepository.delete(id);
  },
};
