import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createTransactionBody,
  setCategoryBody,
  updateTransactionBody,
} from '../schemas/transaction.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const transactionRouter = Router();

transactionRouter.use(authenticate);

transactionRouter.get('/', asyncHandler(transactionController.list));
transactionRouter.get('/suggestions', asyncHandler(transactionController.suggestions));
transactionRouter.post(
  '/',
  validate({ body: createTransactionBody }),
  asyncHandler(transactionController.create),
);
transactionRouter.get('/:id', validate({ params: idParam }), asyncHandler(transactionController.get));
transactionRouter.put(
  '/:id',
  validate({ params: idParam, body: updateTransactionBody }),
  asyncHandler(transactionController.update),
);
transactionRouter.patch(
  '/:id/category',
  validate({ params: idParam, body: setCategoryBody }),
  asyncHandler(transactionController.setCategory),
);
transactionRouter.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(transactionController.remove),
);
