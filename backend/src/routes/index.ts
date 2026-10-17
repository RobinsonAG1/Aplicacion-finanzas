import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth.route.js';
import { accountRouter } from './account.route.js';
import { categoryRouter } from './category.route.js';
import { transactionRouter } from './transaction.route.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/accounts', accountRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/transactions', transactionRouter);
