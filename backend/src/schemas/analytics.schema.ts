import { z } from 'zod';

export const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const monthlyQuery = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const timelineQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});

export type RangeQuery = z.infer<typeof rangeQuery>;
export type TimelineQuery = z.infer<typeof timelineQuery>;
