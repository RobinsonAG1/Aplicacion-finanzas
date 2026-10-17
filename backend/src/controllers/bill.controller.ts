import type { Request, Response } from 'express';
import { billService } from '../services/bill.service.js';
import { requireUserId } from '../utils/authContext.js';
import {
  createReminderBody,
  listBillsQuery,
  runRemindersBody,
  upcomingQuery,
} from '../schemas/bill.schema.js';
import type {
  CreateBillInput,
  PayBillInput,
  UpdateBillInput,
} from '../schemas/bill.schema.js';

export const billController = {
  async list(req: Request, res: Response): Promise<void> {
    const { isActive } = listBillsQuery.parse(req.query);
    const bills = await billService.list(requireUserId(req), isActive);
    res.status(200).json({ data: bills });
  },

  async upcoming(req: Request, res: Response): Promise<void> {
    const { days } = upcomingQuery.parse(req.query);
    const result = await billService.upcoming(requireUserId(req), days);
    res.status(200).json({ data: result });
  },

  async get(req: Request, res: Response): Promise<void> {
    const bill = await billService.get(requireUserId(req), req.params.id as string);
    res.status(200).json({ data: bill });
  },

  async create(req: Request, res: Response): Promise<void> {
    const bill = await billService.create(requireUserId(req), req.body as CreateBillInput);
    res.status(201).json({ data: bill });
  },

  async update(req: Request, res: Response): Promise<void> {
    const bill = await billService.update(
      requireUserId(req),
      req.params.id as string,
      req.body as UpdateBillInput,
    );
    res.status(200).json({ data: bill });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await billService.remove(requireUserId(req), req.params.id as string);
    res.status(204).send();
  },

  async listReminders(req: Request, res: Response): Promise<void> {
    const reminders = await billService.listReminders(
      requireUserId(req),
      req.params.id as string,
    );
    res.status(200).json({ data: reminders });
  },

  async createReminder(req: Request, res: Response): Promise<void> {
    const reminder = await billService.createReminder(
      requireUserId(req),
      req.params.id as string,
      createReminderBody.parse(req.body),
    );
    res.status(201).json({ data: reminder });
  },

  async runReminders(req: Request, res: Response): Promise<void> {
    const result = await billService.runReminders(
      requireUserId(req),
      runRemindersBody.parse(req.body),
    );
    res.status(200).json({ data: result });
  },

  async pay(req: Request, res: Response): Promise<void> {
    const result = await billService.pay(
      requireUserId(req),
      req.params.id as string,
      req.body as PayBillInput,
    );
    res.status(201).json({ data: result });
  },
};
