import { analyticsRepository } from '../repositories/analytics.repository.js';
import type { RangeQuery, TimelineQuery } from '../schemas/analytics.schema.js';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function monthsRange(months: number): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfMonth(addMonths(now, -(months - 1))), to: endOfMonth(now) };
}

export const analyticsService = {
  async summary(userId: string, query: RangeQuery) {
    const now = new Date();
    const from = query.from ?? startOfMonth(now);
    const to = query.to ?? now;

    const [totalsRow] = await analyticsRepository.totals(userId, from, to);
    const totals = totalsRow ?? { income: 0, expense: 0, net: 0 };
    const [byCategory, byAccount] = await Promise.all([
      analyticsRepository.expenseByCategory(userId, from, to),
      analyticsRepository.netByAccount(userId, from, to),
    ]);

    const savingsRate =
      totals.income > 0 ? round((totals.net / totals.income) * 100, 1) : 0;

    return {
      from,
      to,
      totals: {
        income: round(totals.income),
        expense: round(totals.expense),
        net: round(totals.net),
        savingsRate,
      },
      byCategory,
      byAccount,
    };
  },

  async monthly(userId: string, months: number) {
    const now = new Date();
    const from = startOfMonth(addMonths(now, -(months - 1)));
    const to = startOfMonth(now);
    const series = await analyticsRepository.monthlySeries(userId, from, to);
    return { from, to: endOfMonth(now), months: series };
  },

  async categoryTrends(userId: string, months: number) {
    const { from, to } = monthsRange(months);
    const trends = await analyticsRepository.categoryTrends(userId, from, to);
    return { from, to, trends };
  },

  async balanceTimeline(userId: string, query: TimelineQuery) {
    const now = new Date();
    const from = query.from ?? addDays(now, -30);
    const to = query.to ?? now;
    const timeline = await analyticsRepository.balanceTimeline(userId, from, to, query.limit);
    return { from, to, timeline };
  },
};
