import { z } from 'zod';

export const idParam = z.object({
  id: z.string().min(1, 'id obligatorio'),
});
