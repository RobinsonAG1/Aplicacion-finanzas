import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession


async def totals(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> RowMapping:
    result = await db.execute(
        text(
            """
            SELECT
              COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)::float8 AS income,
              COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0)::float8 AS expense,
              COALESCE(
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END),
                0
              )::float8 AS net
            FROM transactions
            WHERE user_id = :user_id AND date >= :date_from AND date <= :date_to
            """
        ),
        {"user_id": user_id, "date_from": date_from, "date_to": date_to},
    )
    return result.mappings().one()


async def expense_by_category(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> Sequence[RowMapping]:
    result = await db.execute(
        text(
            """
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
            JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :user_id
              AND t.type = 'EXPENSE'
              AND t.date >= :date_from
              AND t.date <= :date_to
            GROUP BY c.id, c.name, c.color
            ORDER BY total DESC
            """
        ),
        {"user_id": user_id, "date_from": date_from, "date_to": date_to},
    )
    return result.mappings().all()


async def net_by_account(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> Sequence[RowMapping]:
    result = await db.execute(
        text(
            """
            SELECT
              a.id,
              a.name,
              a.type::text AS type,
              a.balance::float8 AS balance,
              COALESCE(
                SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END),
                0
              )::float8 AS net,
              COUNT(t.id)::int AS transactions
            FROM accounts a
            LEFT JOIN transactions t
              ON t.account_id = a.id
             AND t.date >= :date_from
             AND t.date <= :date_to
            WHERE a.user_id = :user_id
            GROUP BY a.id, a.name, a.type, a.balance
            ORDER BY net DESC
            """
        ),
        {"user_id": user_id, "date_from": date_from, "date_to": date_to},
    )
    return result.mappings().all()


async def monthly_series(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> Sequence[RowMapping]:
    result = await db.execute(
        text(
            """
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', CAST(:date_from AS timestamptz)),
                date_trunc('month', CAST(:date_to AS timestamptz)),
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
                ON t.user_id = :user_id
               AND t.date >= m.month
               AND t.date < m.month + interval '1 month'
              GROUP BY m.month
            )
            SELECT
              to_char(month, 'YYYY-MM') AS month,
              income::float8 AS income,
              expense::float8 AS expense,
              (income - expense)::float8 AS net,
              SUM(income - expense) OVER (ORDER BY month)::float8 AS cumulative_net
            FROM agg
            ORDER BY month
            """
        ),
        {"user_id": user_id, "date_from": date_from, "date_to": date_to},
    )
    return result.mappings().all()


async def category_trends(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> Sequence[RowMapping]:
    result = await db.execute(
        text(
            """
            WITH monthly AS (
              SELECT
                to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
                c.id AS category_id,
                c.name AS category_name,
                c.color,
                SUM(t.amount) AS total
              FROM transactions t
              JOIN categories c ON c.id = t.category_id
              WHERE t.user_id = :user_id
                AND t.type = 'EXPENSE'
                AND t.date >= :date_from
                AND t.date <= :date_to
              GROUP BY 1, 2, 3, 4
            )
            SELECT
              month,
              category_id,
              category_name,
              color,
              total::float8 AS total,
              LAG(total) OVER (
                PARTITION BY category_id ORDER BY month
              )::float8 AS previous,
              CASE
                WHEN LAG(total) OVER (PARTITION BY category_id ORDER BY month) > 0
                THEN ROUND(
                  100.0 * (
                    total - LAG(total) OVER (PARTITION BY category_id ORDER BY month)
                  ) / LAG(total) OVER (PARTITION BY category_id ORDER BY month),
                  1
                )::float8
              END AS change_pct
            FROM monthly
            ORDER BY month DESC, total DESC
            """
        ),
        {"user_id": user_id, "date_from": date_from, "date_to": date_to},
    )
    return result.mappings().all()


async def balance_timeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    date_from: datetime,
    date_to: datetime,
    limit: int,
) -> Sequence[RowMapping]:
    result = await db.execute(
        text(
            """
            SELECT
              date,
              (CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)::float8 AS delta,
              SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)
                OVER (
                  ORDER BY date, id
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                )::float8 AS running_balance
            FROM transactions
            WHERE user_id = :user_id
              AND date >= :date_from
              AND date <= :date_to
            ORDER BY date, id
            LIMIT :limit
            """
        ),
        {
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
        },
    )
    return result.mappings().all()
