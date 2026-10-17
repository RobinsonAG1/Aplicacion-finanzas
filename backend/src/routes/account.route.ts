import { Router } from 'express';
import { accountController } from '../controllers/account.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { createAccountBody, updateAccountBody } from '../schemas/account.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const accountRouter = Router();

accountRouter.use(authenticate);

accountRouter.get('/', asyncHandler(accountController.list));
accountRouter.post('/', validate({ body: createAccountBody }), asyncHandler(accountController.create));
accountRouter.get('/:id', validate({ params: idParam }), asyncHandler(accountController.get));
accountRouter.put(
  '/:id',
  validate({ params: idParam, body: updateAccountBody }),
  asyncHandler(accountController.update),
);
accountRouter.delete('/:id', validate({ params: idParam }), asyncHandler(accountController.remove));
