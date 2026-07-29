import { z } from 'zod';

export const listPayrollSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  employeeId: z.string().uuid().optional(),
});

export const upsertSalaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  baseSalary: z.coerce.number().positive(),
  allowances: z.array(z.object({ label: z.string(), amount: z.coerce.number() })).default([]),
  deductions: z.array(z.object({ label: z.string(), amount: z.coerce.number() })).default([]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const generatePayrollSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const updatePayrollStatusSchema = z.object({
  status: z.enum(['PROCESSED', 'PAID', 'CANCELLED']),
});
