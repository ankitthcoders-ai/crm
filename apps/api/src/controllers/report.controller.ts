import { Response } from 'express';
import { reportService } from '../services/report.service';
import { payslipService } from '../services/payslip.service';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';

export class ReportController {
  async getAttendanceReport(req: AuthenticatedRequest, res: Response) {
    const report = await reportService.generateAttendanceReport(
      req.user!,
      req.query as any
    );
    return sendSuccess(res, report);
  }

  async getPayrollReport(req: AuthenticatedRequest, res: Response) {
    const report = await reportService.generatePayrollReport(
      req.user!,
      req.query as any
    );
    return sendSuccess(res, report);
  }

  async getProjectProgressReport(req: AuthenticatedRequest, res: Response) {
    const report = await reportService.generateProjectProgressReport(req.user!);
    return sendSuccess(res, report);
  }

  async getLeaveReport(req: AuthenticatedRequest, res: Response) {
    const report = await reportService.generateLeaveReport(
      req.user!,
      req.query as any
    );
    return sendSuccess(res, report);
  }

  async getProductivityReport(req: AuthenticatedRequest, res: Response) {
    const report = await reportService.generateProductivityReport(
      req.user!,
      req.query as any
    );
    return sendSuccess(res, report);
  }

  async exportAttendanceReport(req: AuthenticatedRequest, res: Response) {
    const query = req.query as any;
    const report = await reportService.generateAttendanceReport(req.user!, {
      startDate: query.startDate,
      endDate: query.endDate,
      departmentId: query.departmentId,
    });

    const format = query.format || 'csv';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `attendance-report-${timestamp}`;

    if (format === 'csv') {
      const csv = reportService.exportToCSV(report.data, filename);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const json = reportService.exportToJSON(report.data, {
        reportType: 'attendance',
        ...report.stats,
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(json);
    }
  }

  async exportPayrollReport(req: AuthenticatedRequest, res: Response) {
    const query = req.query as any;
    const month = Number(query.month);
    const year = Number(query.year);

    const format = query.format || 'csv';

    if (format === 'pdf') {
      const pdf = await payslipService.generatePayrollReportPdf(req.user!.companyId, month, year);
      const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="payroll_report_${monthName.replace(/\s/g, '_')}.pdf"`);
      return res.send(pdf);
    }

    const report = await reportService.generatePayrollReport(req.user!, { month, year });
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `payroll-report-${timestamp}`;

    if (format === 'csv') {
      const csvData = (report.data as any[]).map((p: any) => ({
        Employee: `${p.employee?.user?.firstName ?? ''} ${p.employee?.user?.lastName ?? ''}`,
        Code: p.employee?.employeeCode ?? '',
        Department: p.employee?.department?.name ?? '',
        'Base Salary': Number(p.baseSalary),
        Allowances: Number(p.allowances),
        Deductions: Number(p.deductions),
        'Net Salary': Number(p.netSalary),
        Status: p.status,
        'Payable Days': Number(p.payableDays),
      }));
      const csv = reportService.exportToCSV(csvData, filename);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const json = reportService.exportToJSON(report.data, {
        reportType: 'payroll',
        month,
        year,
        ...report.totals,
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(json);
    }
  }
}

export const reportController = new ReportController();
