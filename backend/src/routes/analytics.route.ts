import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get('/summary', asyncHandler(analyticsController.summary));
analyticsRouter.get('/monthly', asyncHandler(analyticsController.monthly));
analyticsRouter.get('/category-trends', asyncHandler(analyticsController.categoryTrends));
analyticsRouter.get('/balance-timeline', asyncHandler(analyticsController.balanceTimeline));
