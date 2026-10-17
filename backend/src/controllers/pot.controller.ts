import type { Request, Response } from 'express';
import { potService } from '../services/pot.service.js';
import { requireUserId } from '../utils/authContext.js';
import { potTransactionsQuery } from '../schemas/pot.schema.js';
import type { CreatePotInput, PotMovementInput, UpdatePotInput } from '../schemas/pot.schema.js';

export const potController = {
  async list(req: Request, res: Response): Promise<void> {
    const pots = await potService.list(requireUserId(req));
    res.status(200).json({ data: pots });
  },

  async get(req: Request, res: Response): Promise<void> {
    const { limit } = potTransactionsQuery.parse(req.query);
    const pot = await potService.get(requireUserId(req), req.params.id as string, limit);
    res.status(200).json({ data: pot });
  },

  async create(req: Request, res: Response): Promise<void> {
    const pot = await potService.create(requireUserId(req), req.body as CreatePotInput);
    res.status(201).json({ data: pot });
  },

  async update(req: Request, res: Response): Promise<void> {
    const pot = await potService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdatePotInput,
    );
    res.status(200).json({ data: pot });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await potService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },

  async deposit(req: Request, res: Response): Promise<void> {
    const pot = await potService.deposit(
      requireUserId(req),
      req.params.id as string,
      req.body as PotMovementInput,
    );
    res.status(201).json({ data: pot });
  },

  async withdraw(req: Request, res: Response): Promise<void> {
    const pot = await potService.withdraw(
      requireUserId(req),
      req.params.id as string,
      req.body as PotMovementInput,
    );
    res.status(201).json({ data: pot });
  },
};
