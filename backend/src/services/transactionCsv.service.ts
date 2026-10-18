import { TransactionType } from '../generated/prisma/enums.js';
import { AppError } from '../utils/AppError.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { accountRepository } from '../repositories/account.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { transactionService } from './transaction.service.js';
import type { ExportTransactionsQuery } from '../schemas/transaction.schema.js';

const CSV_HEADER = ['fecha', 'tipo', 'monto', 'cuenta', 'categoria', 'comercio', 'descripcion'];

const MAX_IMPORT_ROWS = 5000;
const MAX_IMPORT_FIELD_LENGTH = 2000;

const COLUMN_ALIASES: Record<string, string> = {
  fecha: 'date',
  date: 'date',
  monto: 'amount',
  valor: 'amount',
  amount: 'amount',
  tipo: 'type',
  type: 'type',
  cuenta: 'account',
  account: 'account',
  categoria: 'category',
  category: 'category',
  comercio: 'merchant',
  merchant: 'merchant',
  descripcion: 'description',
  detalle: 'description',
  description: 'description',
};

const TYPE_ALIASES: Record<string, TransactionType> = {
  ingreso: TransactionType.INCOME,
  ingresos: TransactionType.INCOME,
  income: TransactionType.INCOME,
  entrada: TransactionType.INCOME,
  gasto: TransactionType.EXPENSE,
  gastos: TransactionType.EXPENSE,
  expense: TransactionType.EXPENSE,
  egreso: TransactionType.EXPENSE,
  salida: TransactionType.EXPENSE,
  transferencia: TransactionType.TRANSFER,
  transfer: TransactionType.TRANSFER,
};

const TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.INCOME]: 'ingreso',
  [TransactionType.EXPENSE]: 'gasto',
  [TransactionType.TRANSFER]: 'transferencia',
};

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function parseAmount(raw: string): number {
  let text = raw.replace(/[^\d.,-]/g, '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const decimals = text.length - lastComma - 1;
    if (decimals === 3 && /^-?\d{1,3}(,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(',', '.');
    }
  } else if (lastDot > -1) {
    const decimals = text.length - lastDot - 1;
    if (decimals === 3 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    }
  }
  return Number(text);
}

export function parseDate(raw: string): Date | null {
  const text = raw.trim();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function resolveType(raw: string, amount: number): TransactionType {
  const mapped = TYPE_ALIASES[normalize(raw)];
  if (mapped) return mapped;
  if (normalize(raw) === '' && amount < 0) return TransactionType.EXPENSE;
  return TransactionType.EXPENSE;
}

function dedupKey(
  accountId: string,
  date: Date,
  amount: number,
  type: TransactionType,
  merchant: string | undefined,
): string {
  const day = date.toISOString().slice(0, 10);
  return [accountId, day, amount.toFixed(2), type, (merchant ?? '').toLowerCase()].join('|');
}

export const transactionCsvService = {
  async exportCsv(userId: string, query: ExportTransactionsQuery): Promise<string> {
    const rows = await transactionRepository.findForExport(userId, query);
    const data = rows.map((t) => [
      t.date.toISOString().slice(0, 10),
      TYPE_LABELS[t.type],
      t.amount.toFixed(2),
      t.account.name,
      t.category?.name ?? '',
      t.merchant ?? '',
      t.description ?? '',
    ]);
    return `\uFEFF${toCsv(CSV_HEADER, data)}`;
  },

  async importCsv(userId: string, csvText: string): Promise<ImportSummary> {
    const parsed = parseCsv(csvText);
    const headerRow = parsed[0];
    if (!headerRow) {
      throw new AppError('El archivo CSV esta vacio', 400, { code: 'CSV_EMPTY' });
    }

    const index: Record<string, number> = {};
    headerRow.forEach((cell, i) => {
      const field = COLUMN_ALIASES[normalize(cell)];
      if (field !== undefined && index[field] === undefined) index[field] = i;
    });
    if (index.date === undefined || index.amount === undefined) {
      throw new AppError('El CSV debe incluir las columnas "fecha" y "monto"', 400, {
        code: 'CSV_MISSING_COLUMNS',
      });
    }

    if (parsed.length - 1 > MAX_IMPORT_ROWS) {
      throw new AppError(`El CSV supera el maximo de ${MAX_IMPORT_ROWS} filas`, 400, {
        code: 'CSV_TOO_MANY_ROWS',
      });
    }

    const accounts = await accountRepository.listByUser(userId);
    const categories = await categoryRepository.listByUser(userId);
    const accountByName = new Map(accounts.map((a) => [normalize(a.name), a]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const existing = await transactionRepository.findExistingKeys(
      userId,
      accounts.map((a) => a.id),
    );
    const seen = new Set(
      existing.map((e) =>
        dedupKey(e.accountId, e.date, Number(e.amount), e.type, e.merchant ?? undefined),
      ),
    );

    const summary: ImportSummary = { total: 0, imported: 0, skipped: 0, errors: [] };

    for (let r = 1; r < parsed.length; r += 1) {
      const raw = parsed[r] as string[];
      if (raw.every((cell) => cell.trim() === '')) continue;
      summary.total += 1;

      if (raw.some((cell) => cell.length > MAX_IMPORT_FIELD_LENGTH)) {
        summary.errors.push({ row: r + 1, message: 'campo demasiado largo' });
        continue;
      }

      const get = (field: string): string => {
        const col = index[field];
        return col === undefined ? '' : (raw[col] ?? '').trim();
      };

      try {
        const date = parseDate(get('date'));
        if (!date) throw new Error('fecha invalida');

        const parsedAmount = parseAmount(get('amount'));
        if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
          throw new Error('monto invalido');
        }
        const type = resolveType(get('type'), parsedAmount);
        const amount = Math.abs(parsedAmount);

        const accountRaw = get('account');
        const account =
          (accountRaw ? accountByName.get(normalize(accountRaw)) : undefined) ??
          accountById.get(accountRaw);
        if (!account) {
          throw new Error(accountRaw ? `cuenta no encontrada: "${accountRaw}"` : 'cuenta requerida');
        }

        const categoryRaw = get('category');
        const category = categoryRaw
          ? categories.find(
              (c) => normalize(c.name) === normalize(categoryRaw) && c.type === type,
            ) ?? categories.find((c) => normalize(c.name) === normalize(categoryRaw))
          : undefined;

        const merchant = get('merchant') || undefined;
        const description = get('description') || undefined;

        const key = dedupKey(account.id, date, amount, type, merchant);
        if (seen.has(key)) {
          summary.skipped += 1;
          continue;
        }

        await transactionService.create(userId, {
          accountId: account.id,
          categoryId: category?.id ?? null,
          amount,
          type,
          description,
          merchant,
          date,
        });
        seen.add(key);
        summary.imported += 1;
      } catch (err) {
        summary.errors.push({
          row: r + 1,
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    return summary;
  },
};
