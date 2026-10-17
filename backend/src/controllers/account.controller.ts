import type { Request, Response } from 'express';
import { accountService } from '../services/account.service.js';
import { requireUserId } from '../utils/authContext.js';
import type { CreateAccountInput, UpdateAccountInput } from '../schemas/account.schema.js';

export const accountController = {
  async list(req: Request, res: Response): Promise<void> {
    const accounts = await accountService.list(requireUserId(req));
    res.status(200).json({ data: accounts });
  },

  async create(req: Request, res: Response): Promise<void> {
    const account = await accountService.create(requireUserId(req), req.body as CreateAccountInput);
    res.status(201).json({ data: account });
  },

  async get(req: Request, res: Response): Promise<void> {
    const account = await accountService.get(requireUserId(req), req.params.id as string);
    res.status(200).json({ data: account });
  },

  async update(req: Request, res: Response): Promise<void> {
    const account = await accountService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateAccountInput,
    );
    res.status(200).json({ data: account });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await accountService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },
};
