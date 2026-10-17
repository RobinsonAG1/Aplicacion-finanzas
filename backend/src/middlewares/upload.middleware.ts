import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const looksLikeCsv =
      /csv|text\/plain|application\/vnd\.ms-excel/.test(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!looksLikeCsv) {
      cb(new AppError('Formato de archivo no soportado (se espera CSV)', 415, { code: 'UNSUPPORTED_FILE' }));
      return;
    }
    cb(null, true);
  },
});

export function uploadCsv(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof multer.MulterError) {
      next(new AppError(`Archivo invalido: ${err.code}`, 400, { code: 'UPLOAD_ERROR' }));
      return;
    }
    next(err);
  });
}
