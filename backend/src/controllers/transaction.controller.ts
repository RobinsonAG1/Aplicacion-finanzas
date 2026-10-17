import type { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service.js';
import { requireUserId } from '../utils/authContext.js';
import {
  listTransactionsQuery,
  setCategoryBody,
  suggestionsQuery,
} from '../schemas/transaction.schema.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../schemas/transaction.schema.js';

export const transactionController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = listTransactionsQuery.parse(req.query);
    const { items, meta } = await transactionService.list(requireUserId(req), query);
    res.status(200).json({ data: items, meta });
  },

  async get(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.get(
      requireUserId(req),
      req.params.id as string,
    );
    res.status(200).json({ data: transaction });
  },

  async create(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.create(
      requireUserId(req),
      req.body as CreateTransactionInput,
    );
    res.status(201).json({ data: transaction });
  },

  async update(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateTransactionInput,
    );
    res.status(200).json({ data: transaction });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await transactionService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },

  async setCategory(req: Request, res: Response): Promise<void> {
    const { categoryId } = setCategoryBody.parse(req.body);
    const transaction = await transactionService.setCategory(
      requireUserId(req),
      req.params.id as string,
      categoryId,
    );
    res.status(200).json({ data: transaction });
  },

  async suggestions(req: Request, res: Response): Promise<void> {
    const { merchant } = suggestionsQuery.parse(req.query);
    const result = await transactionService.suggestions(requireUserId(req), merchant);
    res.status(200).json(result);
  },
};
