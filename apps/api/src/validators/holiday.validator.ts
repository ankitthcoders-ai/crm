import { z } from 'zod';

export const createHolidaySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  isOptional: z.boolean().optional(),
});
