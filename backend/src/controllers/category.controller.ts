import type { Request, Response } from 'express';
import { categoryService } from '../services/category.service.js';
import { requireUserId } from '../utils/authContext.js';
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';

export const categoryController = {
  async list(req: Request, res: Response): Promise<void> {
    const categories = await categoryService.list(requireUserId(req));
    res.status(200).json({ data: categories });
  },

  async create(req: Request, res: Response): Promise<void> {
    const category = await categoryService.create(
      requireUserId(req),
      req.body as CreateCategoryInput,
    );
    res.status(201).json({ data: category });
  },

  async get(req: Request, res: Response): Promise<void> {
    const category = await categoryService.get(requireUserId(req), req.params.id as string);
    res.status(200).json({ data: category });
  },

  async update(req: Request, res: Response): Promise<void> {
    const category = await categoryService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateCategoryInput,
    );
    res.status(200).json({ data: category });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await categoryService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },
};
