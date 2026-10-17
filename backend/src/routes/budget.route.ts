import { Router } from 'express';
import { budgetController } from '../controllers/budget.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { createBudgetBody, updateBudgetBody } from '../schemas/budget.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const budgetRouter = Router();

budgetRouter.use(authenticate);

budgetRouter.get('/', asyncHandler(budgetController.list));
budgetRouter.get('/overview', asyncHandler(budgetController.overview));
budgetRouter.post(
  '/',
  validate({ body: createBudgetBody }),
  asyncHandler(budgetController.create),
);
budgetRouter.get('/:id', validate({ params: idParam }), asyncHandler(budgetController.get));
budgetRouter.put(
  '/:id',
  validate({ params: idParam, body: updateBudgetBody }),
  asyncHandler(budgetController.update),
);
budgetRouter.delete('/:id', validate({ params: idParam }), asyncHandler(budgetController.remove));
