import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@crm/shared';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { reportController } from '../controllers/report.controller';
import {
  attendanceReportSchema,
  payrollReportSchema,
  leaveReportSchema,
  productivityReportSchema,
  exportAttendanceReportSchema,
} from '../validators/report.validator';

const router = Router();

// All report endpoints require authentication
router.use(authenticate);

/**
 * GET /api/v1/reports/attendance
 * Generate attendance report
 */
router.get(
  '/attendance',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_READ),
  validate(attendanceReportSchema, 'query'),
  (req, res, next) => reportController.getAttendanceReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/payroll
 * Generate payroll report
 */
router.get(
  '/payroll',
  requireAnyPermission(PERMISSIONS.PAYROLL_READ),
  validate(payrollReportSchema, 'query'),
  (req, res, next) => reportController.getPayrollReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/projects
 * Generate project progress report
 */
router.get(
  '/projects',
  requireAnyPermission(PERMISSIONS.PROJECTS_READ),
  (req, res, next) => reportController.getProjectProgressReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/leaves
 * Generate leave report
 */
router.get(
  '/leaves',
  requireAnyPermission(PERMISSIONS.LEAVES_READ),
  validate(leaveReportSchema, 'query'),
  (req, res, next) => reportController.getLeaveReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/productivity
 * Generate productivity report
 */
router.get(
  '/productivity',
  requireAnyPermission(PERMISSIONS.REPORTS_EXPORT),
  validate(productivityReportSchema, 'query'),
  (req, res, next) => reportController.getProductivityReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/attendance/export
 * Export attendance report as CSV or JSON
 */
router.get(
  '/attendance/export',
  requireAnyPermission(PERMISSIONS.REPORTS_EXPORT),
  validate(exportAttendanceReportSchema, 'query'),
  (req, res, next) => reportController.exportAttendanceReport(req, res).catch(next)
);

/**
 * GET /api/v1/reports/payroll/export
 * Export payroll report as PDF, CSV, or JSON
 */
router.get(
  '/payroll/export',
  requireAnyPermission(PERMISSIONS.REPORTS_EXPORT),
  validate(payrollReportSchema.extend({ format: z.enum(['pdf', 'csv', 'json']).optional().default('pdf' as any) }), 'query'),
  (req, res, next) => reportController.exportPayrollReport(req, res).catch(next)
);

export default router;
