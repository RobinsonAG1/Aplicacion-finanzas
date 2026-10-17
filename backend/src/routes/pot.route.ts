import { Router } from 'express';
import { potController } from '../controllers/pot.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { createPotBody, potMovementBody, updatePotBody } from '../schemas/pot.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const potRouter = Router();

potRouter.use(authenticate);

potRouter.get('/', asyncHandler(potController.list));
potRouter.post('/', validate({ body: createPotBody }), asyncHandler(potController.create));
potRouter.get('/:id', validate({ params: idParam }), asyncHandler(potController.get));
potRouter.put(
  '/:id',
  validate({ params: idParam, body: updatePotBody }),
  asyncHandler(potController.update),
);
potRouter.delete('/:id', validate({ params: idParam }), asyncHandler(potController.remove));
potRouter.post(
  '/:id/deposit',
  validate({ params: idParam, body: potMovementBody }),
  asyncHandler(potController.deposit),
);
potRouter.post(
  '/:id/withdraw',
  validate({ params: idParam, body: potMovementBody }),
  asyncHandler(potController.withdraw),
);
