import { Router } from 'express';
import { categoryController } from '../controllers/category.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { createCategoryBody, updateCategoryBody } from '../schemas/category.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const categoryRouter = Router();

categoryRouter.use(authenticate);

categoryRouter.get('/', asyncHandler(categoryController.list));
categoryRouter.post(
  '/',
  validate({ body: createCategoryBody }),
  asyncHandler(categoryController.create),
);
categoryRouter.get('/:id', validate({ params: idParam }), asyncHandler(categoryController.get));
categoryRouter.put(
  '/:id',
  validate({ params: idParam, body: updateCategoryBody }),
  asyncHandler(categoryController.update),
);
categoryRouter.delete('/:id', validate({ params: idParam }), asyncHandler(categoryController.remove));
