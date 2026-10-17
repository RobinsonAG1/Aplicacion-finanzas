import type { Request, Response } from 'express';
import { budgetService } from '../services/budget.service.js';
import { requireUserId } from '../utils/authContext.js';
import { budgetOverviewQuery, listBudgetsQuery } from '../schemas/budget.schema.js';
import type { CreateBudgetInput, UpdateBudgetInput } from '../schemas/budget.schema.js';

export const budgetController = {
  async list(req: Request, res: Response): Promise<void> {
    const { period } = listBudgetsQuery.parse(req.query);
    const budgets = await budgetService.list(requireUserId(req), period);
    res.status(200).json({ data: budgets });
  },

  async overview(req: Request, res: Response): Promise<void> {
    const query = budgetOverviewQuery.parse(req.query);
    const result = await budgetService.overview(requireUserId(req), query);
    res.status(200).json({ data: result });
  },

  async get(req: Request, res: Response): Promise<void> {
    const budget = await budgetService.get(requireUserId(req), req.params.id as string);
    res.status(200).json({ data: budget });
  },

  async create(req: Request, res: Response): Promise<void> {
    const budget = await budgetService.create(requireUserId(req), req.body as CreateBudgetInput);
    res.status(201).json({ data: budget });
  },

  async update(req: Request, res: Response): Promise<void> {
    const budget = await budgetService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateBudgetInput,
    );
    res.status(200).json({ data: budget });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await budgetService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },
};
