import { Router } from 'express';
import { billController } from '../controllers/bill.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createBillBody,
  createReminderBody,
  payBillBody,
  updateBillBody,
} from '../schemas/bill.schema.js';
import { idParam } from '../schemas/common.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const billRouter = Router();

billRouter.use(authenticate);

billRouter.get('/', asyncHandler(billController.list));
billRouter.get('/upcoming', asyncHandler(billController.upcoming));
billRouter.post('/reminders/run', asyncHandler(billController.runReminders));
billRouter.post('/', validate({ body: createBillBody }), asyncHandler(billController.create));
billRouter.get('/:id', validate({ params: idParam }), asyncHandler(billController.get));
billRouter.put(
  '/:id',
  validate({ params: idParam, body: updateBillBody }),
  asyncHandler(billController.update),
);
billRouter.delete('/:id', validate({ params: idParam }), asyncHandler(billController.remove));
billRouter.get(
  '/:id/reminders',
  validate({ params: idParam }),
  asyncHandler(billController.listReminders),
);
billRouter.post(
  '/:id/reminders',
  validate({ params: idParam, body: createReminderBody }),
  asyncHandler(billController.createReminder),
);
billRouter.post(
  '/:id/pay',
  validate({ params: idParam, body: payBillBody }),
  asyncHandler(billController.pay),
);
