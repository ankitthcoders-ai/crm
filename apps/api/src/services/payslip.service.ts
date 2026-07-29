import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';

function fmt(val: number | string | { toString(): string }, decimals = 2): string {
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export class PayslipService {
  async generatePayslip(companyId: string, payrollId: string): Promise<Buffer> {
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!payroll || payroll.employee.companyId !== companyId) {
      throw new NotFoundError('Payroll record not found');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, currency: true },
    });

    const currency = company?.currency === 'INR' ? '\u20B9' : '$';
    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { employeeId: payroll.employeeId },
    });

    const allowanceItems = (salaryStructure?.allowances as Array<{ label: string; amount: number }>) ?? [];
    const deductionItems = (salaryStructure?.deductions as Array<{ label: string; amount: number }>) ?? [];

    const pageWidth = doc.page.width - 100;
    const leftCol = 50;
    const rightCol = 50 + pageWidth / 2;

    // ── Header ──
    doc.fontSize(20).font('Helvetica-Bold').text(company?.name ?? 'Company', leftCol, 50);
    doc.fontSize(10).font('Helvetica').text('Payslip', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text(monthName, leftCol);
    doc.moveDown(0.3);

    // separator
    doc.moveTo(leftCol, doc.y).lineTo(leftCol + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ── Employee Details ──
    const empY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text('Employee Details', leftCol);
    doc.font('Helvetica').fontSize(9);
    const emp = payroll.employee;
    doc.text(`Name: ${emp.user.firstName} ${emp.user.lastName}`, leftCol + 10, doc.y + 4);
    doc.text(`Code: ${emp.employeeCode}`, leftCol + 10);
    doc.text(`Email: ${emp.user.email}`, leftCol + 10);
    doc.text(`Department: ${emp.department?.name ?? '\u2014'}`, rightCol, empY + 14);
    doc.text(`Designation: ${emp.designation?.title ?? '\u2014'}`, rightCol);
    doc.moveDown(0.8);

    // separator
    doc.moveTo(leftCol, doc.y).lineTo(leftCol + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ── Earnings Table ──
    const earnY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').text('Earnings', leftCol);
    doc.moveDown(0.3);

    const tableLeft = leftCol;
    const tableRight = leftCol + pageWidth;
    const col1X = tableLeft;
    const col2X = tableRight - 120;

    // header row
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#555555');
    doc.text('Component', col1X, doc.y, { width: col2X - col1X - 10 });
    doc.text('Amount', col2X, doc.y, { width: 120, align: 'right' });
    doc.moveDown(0.3);

    // line
    const lineY = doc.y;
    doc.moveTo(tableLeft, lineY).lineTo(tableRight, lineY).stroke('#eeeeee');
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(9).fillColor('#000000');

    // rows
    const addRow = (label: string, amount: number, bold = false) => {
      if (bold) doc.font('Helvetica-Bold');
      doc.text(label, col1X, doc.y, { width: col2X - col1X - 10 });
      doc.text(`${currency}${fmt(amount)}`, col2X, doc.y - doc.currentLineHeight(), { width: 120, align: 'right' });
      doc.moveDown(0.2);
      if (bold) doc.font('Helvetica');
    };

    addRow('Basic Salary', Number(payroll.baseSalary));

    for (const a of allowanceItems) {
      addRow(a.label, a.amount);
    }
    if (Number(payroll.allowances) > 0) {
      addRow('Total Allowances', Number(payroll.allowances), true);
    }

    const grossTotalEarnY = doc.y;
    doc.moveDown(0.3);

    // separator
    doc.moveTo(tableLeft, doc.y).lineTo(tableRight, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Gross Total
    doc.fontSize(11).font('Helvetica-Bold');
    const grossTotal = Number(payroll.baseSalary) + Number(payroll.allowances);
    doc.text('Gross Total', col1X);
    doc.text(`${currency}${fmt(grossTotal)}`, col2X, doc.y - doc.currentLineHeight(), { width: 120, align: 'right' });
    doc.moveDown(1);

    // ── Deductions Table ──
    doc.fontSize(11).font('Helvetica-Bold').text('Deductions', leftCol);
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#555555');
    doc.text('Component', col1X, doc.y, { width: col2X - col1X - 10 });
    doc.text('Amount', col2X, doc.y, { width: 120, align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(tableLeft, doc.y).lineTo(tableRight, doc.y).stroke('#eeeeee');
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(9).fillColor('#000000');

    for (const d of deductionItems) {
      addRow(d.label, d.amount);
    }
    if (Number(payroll.deductions) > 0) {
      addRow('Total Deductions', Number(payroll.deductions), true);
    }

    if (Number(payroll.tax) > 0) {
      addRow('Tax', Number(payroll.tax));
    }

    doc.moveDown(0.3);
    doc.moveTo(tableLeft, doc.y).lineTo(tableRight, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Net Payable
    const netY = doc.y;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#15803d');
    doc.text('Net Salary', col1X);
    doc.text(`${currency}${fmt(Number(payroll.netSalary))}`, col2X, doc.y - doc.currentLineHeight(), { width: 120, align: 'right' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    // separator
    doc.moveTo(leftCol, doc.y).lineTo(leftCol + pageWidth, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ── Attendance Summary ──
    doc.fontSize(11).font('Helvetica-Bold').text('Attendance Summary', leftCol);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);

    const attrs = [
      ['Working Days', String(payroll.workingDays)],
      ['Present', String(payroll.presentDays)],
      ['Absent', String(payroll.absentDays)],
      ['Unpaid Leave', String(payroll.unpaidLeaveDays)],
      ['Late Days', String(payroll.lateDays)],
      ['Payable Days', fmt(Number(payroll.payableDays), 1)],
    ];

    const attY = doc.y;
    const attColW = pageWidth / attrs.length;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
    attrs.forEach(([label], i) => doc.text(label, leftCol + i * attColW, attY, { width: attColW, align: 'center' }));
    doc.moveDown(0.3);
    const valY = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor('#000000');
    attrs.forEach(([, value], i) => doc.text(value, leftCol + i * attColW, valY, { width: attColW, align: 'center' }));
    doc.moveDown(1);

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text(`Status: ${payroll.status}`, leftCol, doc.y);
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generatePayrollReportPdf(companyId: string, month: number, year: number): Promise<Buffer> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, currency: true },
    });

    const payrolls = await prisma.payroll.findMany({
      where: {
        employee: { companyId, deletedAt: null },
        month,
        year,
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            department: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const currency = company?.currency === 'INR' ? '\u20B9' : '$';
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(company?.name ?? 'Company', 50, 50);
    doc.fontSize(14).text(`Payroll Report - ${monthName}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // Summary
    const totals = {
      count: payrolls.length,
      base: 0, allowances: 0, deductions: 0, bonus: 0, tax: 0, net: 0,
    };
    for (const p of payrolls) {
      totals.base += Number(p.baseSalary);
      totals.allowances += Number(p.allowances);
      totals.deductions += Number(p.deductions);
      totals.bonus += Number(p.bonus);
      totals.tax += Number(p.tax);
      totals.net += Number(p.netSalary);
    }

    doc.fontSize(11).font('Helvetica-Bold').text('Summary', 50);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);

    const sumData = [
      ['Total Employees', String(totals.count)],
      ['Total Base Salary', `${currency}${fmt(totals.base)}`],
      ['Total Allowances', `${currency}${fmt(totals.allowances)}`],
      ['Total Deductions', `${currency}${fmt(totals.deductions)}`],
      ['Total Net Payout', `${currency}${fmt(totals.net)}`],
    ];

    const sumY = doc.y;
    sumData.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * (doc.page.width / 2 - 75);
      doc.font('Helvetica-Bold').text(label, x, sumY + row * 18, { width: 200 });
      doc.font('Helvetica').text(value, x + 150, sumY + row * 18, { width: 100, align: 'right' });
    });

    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // Employee table header
    const tY = doc.y;
    const cols = [
      { label: 'Employee', x: 50, w: 120 },
      { label: 'Department', x: 170, w: 80 },
      { label: 'Base', x: 250, w: 70, align: 'right' as const },
      { label: 'Allowances', x: 320, w: 70, align: 'right' as const },
      { label: 'Deductions', x: 390, w: 70, align: 'right' as const },
      { label: 'Net', x: 460, w: 80, align: 'right' as const },
    ];

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
    cols.forEach(c => doc.text(c.label, c.x, tY, { width: c.w, align: c.align ?? 'left' }));
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#eeeeee');
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    for (const p of payrolls) {
      const name = p.employee ? `${p.employee.user.firstName} ${p.employee.user.lastName}` : '\u2014';
      const dept = p.employee?.department?.name ?? '\u2014';
      const rowY = doc.y;

      doc.text(name, 50, rowY, { width: 120 });
      doc.text(dept, 170, rowY, { width: 80 });
      doc.text(`${currency}${fmt(p.baseSalary)}`, 250, rowY, { width: 70, align: 'right' });
      doc.text(`${currency}${fmt(p.allowances)}`, 320, rowY, { width: 70, align: 'right' });
      doc.text(`${currency}${fmt(p.deductions)}`, 390, rowY, { width: 70, align: 'right' });
      doc.text(`${currency}${fmt(p.netSalary)}`, 460, rowY, { width: 80, align: 'right' });
      doc.moveDown(0.5);

      if (doc.y > 700) {
        doc.addPage();
      }
    }

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Footer with totals
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Total', 50, doc.y, { width: 120 });
    doc.text(`${currency}${fmt(totals.base)}`, 250, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' });
    doc.text(`${currency}${fmt(totals.allowances)}`, 320, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' });
    doc.text(`${currency}${fmt(totals.deductions)}`, 390, doc.y - doc.currentLineHeight(), { width: 70, align: 'right' });
    doc.text(`${currency}${fmt(totals.net)}`, 460, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
    doc.moveDown(1);

    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, doc.y);
    doc.text(`${payrolls.length} employees`, { align: 'right' });

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }
}

export const payslipService = new PayslipService();
