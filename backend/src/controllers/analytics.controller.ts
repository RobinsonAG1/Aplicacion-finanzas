import type { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service.js';
import { requireUserId } from '../utils/authContext.js';
import { monthlyQuery, rangeQuery, timelineQuery } from '../schemas/analytics.schema.js';

export const analyticsController = {
  async summary(req: Request, res: Response): Promise<void> {
    const result = await analyticsService.summary(requireUserId(req), rangeQuery.parse(req.query));
    res.status(200).json({ data: result });
  },

  async monthly(req: Request, res: Response): Promise<void> {
    const { months } = monthlyQuery.parse(req.query);
    const result = await analyticsService.monthly(requireUserId(req), months);
    res.status(200).json({ data: result });
  },

  async categoryTrends(req: Request, res: Response): Promise<void> {
    const { months } = monthlyQuery.parse(req.query);
    const result = await analyticsService.categoryTrends(requireUserId(req), months);
    res.status(200).json({ data: result });
  },

  async balanceTimeline(req: Request, res: Response): Promise<void> {
    const result = await analyticsService.balanceTimeline(
      requireUserId(req),
      timelineQuery.parse(req.query),
    );
    res.status(200).json({ data: result });
  },
};
