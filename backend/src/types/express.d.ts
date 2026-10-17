import type { AuthUser } from './auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
