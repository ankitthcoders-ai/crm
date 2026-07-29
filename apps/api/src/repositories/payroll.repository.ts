import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const payrollInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
} satisfies Prisma.PayrollInclude;

export class PayrollRepository {
  async list(
    companyId: string,
    query: { page: number; limit: number; month?: number; year?: number; employeeId?: string }
  ) {
    const where: Prisma.PayrollWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(query.month && { month: query.month }),
      ...(query.year && { year: query.year }),
      ...(query.employeeId && { employeeId: query.employeeId }),
    };

    const [items, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: payrollInclude,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.payroll.count({ where }),
    ]);
    return { items, total };
  }

  async listSalaryStructures(companyId: string) {
    return prisma.salaryStructure.findMany({
      where: { employee: { companyId, deletedAt: null } },
      include: payrollInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertSalaryStructure(data: {
    employeeId: string;
    baseSalary: number;
    allowances: unknown[];
    deductions: unknown[];
    effectiveFrom: Date;
  }) {
    return prisma.salaryStructure.upsert({
      where: { employeeId: data.employeeId },
      update: {
        baseSalary: new Prisma.Decimal(data.baseSalary),
        allowances: data.allowances as Prisma.JsonArray,
        deductions: data.deductions as Prisma.JsonArray,
        effectiveFrom: data.effectiveFrom,
      },
      create: {
        employeeId: data.employeeId,
        baseSalary: new Prisma.Decimal(data.baseSalary),
        allowances: data.allowances as Prisma.JsonArray,
        deductions: data.deductions as Prisma.JsonArray,
        effectiveFrom: data.effectiveFrom,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  }

  async generatePayrolls(companyId: string, month: number, year: number, data: Array<Prisma.PayrollCreateManyInput>) {
    return prisma.$transaction(
      data.map((payroll) => 
        prisma.payroll.upsert({
          where: { employeeId_month_year: { employeeId: payroll.employeeId, month, year } },
          update: {
             baseSalary: payroll.baseSalary,
             allowances: payroll.allowances,
             deductions: payroll.deductions,
             netSalary: payroll.netSalary,
             workingDays: payroll.workingDays ?? 0,
             presentDays: payroll.presentDays ?? 0,
             absentDays: payroll.absentDays ?? 0,
             unpaidLeaveDays: payroll.unpaidLeaveDays ?? 0,
             lateDays: payroll.lateDays ?? 0,
             payableDays: payroll.payableDays ?? 0,
             status: 'DRAFT'
          },
          create: payroll
        })
      )
    );
  }

  async findById(companyId: string, id: string) {
    return prisma.payroll.findFirst({
      where: { id, employee: { companyId, deletedAt: null } },
      include: {
        ...payrollInclude,
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: 'PROCESSED' | 'PAID' | 'CANCELLED') {
    return prisma.payroll.update({
      where: { id },
      data: { 
        status,
        ...(status === 'PAID' ? { paidAt: new Date() } : {})
      },
      include: payrollInclude,
    });
  }
}

export const payrollRepository = new PayrollRepository();
