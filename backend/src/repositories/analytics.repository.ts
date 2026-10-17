import { prisma } from '../db/prisma.js';

export interface TotalsRow {
  income: number;
  expense: number;
  net: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
  rank: number;
}

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  balance: number;
  net: number;
  transactions: number;
}

export interface MonthlyRow {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulativeNet: number;
}

export interface TrendRow {
  month: string;
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  previous: number | null;
  changePct: number | null;
}

export interface TimelineRow {
  date: Date;
  delta: number;
  runningBalance: number;
}

export const analyticsRepository = {
  totals(userId: string, from: Date, to: Date) {
    return prisma.$queryRaw<TotalsRow[]>`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)::float8 AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0)::float8 AS expense,
        COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END), 0)::float8 AS net
      FROM transactions
      WHERE "userId" = ${userId} AND date >= ${from} AND date <= ${to}
    `;
  },

  expenseByCategory(userId: string, from: Date, to: Date) {
    return prisma.$queryRaw<CategoryRow[]>`
      SELECT
        c.id,
        c.name,
        c.color,
        SUM(t.amount)::float8 AS total,
        ROUND(
          100.0 * SUM(t.amount) / NULLIF(SUM(SUM(t.amount)) OVER (), 0),
          1
        )::float8 AS percentage,
        (RANK() OVER (ORDER BY SUM(t.amount) DESC))::int AS rank
      FROM transactions t
      JOIN categories c ON c.id = t."categoryId"
      WHERE t."userId" = ${userId}
        AND t.type = 'EXPENSE'
        AND t.date >= ${from}
        AND t.date <= ${to}
      GROUP BY c.id, c.name, c.color
      ORDER BY total DESC
    `;
  },

  netByAccount(userId: string, from: Date, to: Date) {
    return prisma.$queryRaw<AccountRow[]>`
      SELECT
        a.id,
        a.name,
        a.type,
        a.balance::float8 AS balance,
        COALESCE(
          SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END),
          0
        )::float8 AS net,
        COUNT(t.id)::int AS transactions
      FROM accounts a
      LEFT JOIN transactions t
        ON t."accountId" = a.id
       AND t.date >= ${from}
       AND t.date <= ${to}
      WHERE a."userId" = ${userId}
      GROUP BY a.id, a.name, a.type, a.balance
      ORDER BY net DESC
    `;
  },

  monthlySeries(userId: string, from: Date, to: Date) {
    return prisma.$queryRaw<MonthlyRow[]>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${from}::timestamptz),
          date_trunc('month', ${to}::timestamptz),
          interval '1 month'
        ) AS month
      ),
      agg AS (
        SELECT
          m.month,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS income,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS expense
        FROM months m
        LEFT JOIN transactions t
          ON t."userId" = ${userId}
         AND t.date >= m.month
         AND t.date < m.month + interval '1 month'
        GROUP BY m.month
      )
      SELECT
        to_char(month, 'YYYY-MM') AS month,
        income::float8 AS income,
        expense::float8 AS expense,
        (income - expense)::float8 AS net,
        SUM(income - expense) OVER (ORDER BY month)::float8 AS "cumulativeNet"
      FROM agg
      ORDER BY month
    `;
  },

  categoryTrends(userId: string, from: Date, to: Date) {
    return prisma.$queryRaw<TrendRow[]>`
      WITH monthly AS (
        SELECT
          to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
          c.id AS category_id,
          c.name AS category_name,
          c.color,
          SUM(t.amount) AS total
        FROM transactions t
        JOIN categories c ON c.id = t."categoryId"
        WHERE t."userId" = ${userId}
          AND t.type = 'EXPENSE'
          AND t.date >= ${from}
          AND t.date <= ${to}
        GROUP BY 1, 2, 3, 4
      )
      SELECT
        month,
        category_id AS "categoryId",
        category_name AS "categoryName",
        color,
        total::float8 AS total,
        LAG(total) OVER (PARTITION BY category_id ORDER BY month)::float8 AS previous,
        CASE
          WHEN LAG(total) OVER (PARTITION BY category_id ORDER BY month) > 0
          THEN ROUND(
            100.0 * (total - LAG(total) OVER (PARTITION BY category_id ORDER BY month))
            / LAG(total) OVER (PARTITION BY category_id ORDER BY month),
            1
          )::float8
        END AS "changePct"
      FROM monthly
      ORDER BY month DESC, total DESC
    `;
  },

  balanceTimeline(userId: string, from: Date, to: Date, limit: number) {
    return prisma.$queryRaw<TimelineRow[]>`
      SELECT
        date,
        (CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)::float8 AS delta,
        SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)
          OVER (ORDER BY date, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::float8
          AS "runningBalance"
      FROM transactions
      WHERE "userId" = ${userId} AND date >= ${from} AND date <= ${to}
      ORDER BY date, id
      LIMIT ${limit}
    `;
  },
};
