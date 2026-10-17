import type { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service.js';
import { transactionCsvService } from '../services/transactionCsv.service.js';
import { AppError } from '../utils/AppError.js';
import { requireUserId } from '../utils/authContext.js';
import {
  exportTransactionsQuery,
  listTransactionsQuery,
  setCategoryBody,
  suggestionsQuery,
} from '../schemas/transaction.schema.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../schemas/transaction.schema.js';

function extractCsvText(req: Request): string {
  if (req.file) return req.file.buffer.toString('utf8');
  if (typeof req.body === 'string' && req.body.trim() !== '') return req.body;
  const body = req.body as { csv?: unknown } | undefined;
  if (body && typeof body.csv === 'string' && body.csv.trim() !== '') return body.csv;
  throw new AppError(
    'Debe adjuntar un archivo CSV en el campo "file" o enviar el contenido en "csv"',
    400,
    { code: 'CSV_REQUIRED' },
  );
}

export const transactionController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = listTransactionsQuery.parse(req.query);
    const { items, meta } = await transactionService.list(requireUserId(req), query);
    res.status(200).json({ data: items, meta });
  },

  async get(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.get(
      requireUserId(req),
      req.params.id as string,
    );
    res.status(200).json({ data: transaction });
  },

  async create(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.create(
      requireUserId(req),
      req.body as CreateTransactionInput,
    );
    res.status(201).json({ data: transaction });
  },

  async update(req: Request, res: Response): Promise<void> {
    const transaction = await transactionService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateTransactionInput,
    );
    res.status(200).json({ data: transaction });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await transactionService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },

  async setCategory(req: Request, res: Response): Promise<void> {
    const { categoryId } = setCategoryBody.parse(req.body);
    const transaction = await transactionService.setCategory(
      requireUserId(req),
      req.params.id as string,
      categoryId,
    );
    res.status(200).json({ data: transaction });
  },

  async suggestions(req: Request, res: Response): Promise<void> {
    const { merchant } = suggestionsQuery.parse(req.query);
    const result = await transactionService.suggestions(requireUserId(req), merchant);
    res.status(200).json(result);
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const query = exportTransactionsQuery.parse(req.query);
    const csv = await transactionCsvService.exportCsv(requireUserId(req), query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacciones.csv"');
    res.status(200).send(csv);
  },

  async importCsv(req: Request, res: Response): Promise<void> {
    const csvText = extractCsvText(req);
    const summary = await transactionCsvService.importCsv(requireUserId(req), csvText);
    res.status(200).json({ data: summary });
  },
};
