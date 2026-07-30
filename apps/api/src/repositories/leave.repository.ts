import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export class LeaveRepository {
  async findTypes(companyId: string) {
    let types = await prisma.leaveType.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    if (types.length === 0) {
      await prisma.leaveType.createMany({
        data: [
          { companyId, name: 'Casual Leave', code: 'CASUAL', daysPerYear: 12, isPaid: true },
          { companyId, name: 'Sick Leave', code: 'SICK', daysPerYear: 10, isPaid: true },
          { companyId, name: 'Earned Leave', code: 'EARNED', daysPerYear: 15, isPaid: true },
          { companyId, name: 'Unpaid Leave', code: 'UNPAID', daysPerYear: 30, isPaid: false },
        ],
      });
      types = await prisma.leaveType.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      });
    }

    return types;
  }

  async findBalances(employeeId: string, year: number) {
    return prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    });
  }

  async findBalance(employeeId: string, leaveTypeId: string, year: number) {
    return prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
    });
  }

  async findRequests(
    companyId: string,
    opts: {
      page: number;
      limit: number;
      status?: string;
      employeeId?: string;
    }
  ) {
    const where: Prisma.LeaveRequestWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(opts.status && { status: opts.status as Prisma.EnumLeaveStatusFilter }),
      ...(opts.employeeId && { employeeId: opts.employeeId }),
    };

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return { items, total };
  }

  async findRequestById(id: string, companyId: string) {
    return prisma.leaveRequest.findFirst({
      where: { id, employee: { companyId } },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async createRequest(data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    reason?: string;
  }) {
    return prisma.leaveRequest.create({
      data: { ...data, status: 'PENDING' },
      include: { leaveType: true },
    });
  }

  async updateRequestStatus(
    id: string,
    data: {
      status: 'APPROVED' | 'REJECTED' | 'CANCELLED';
      approvedBy?: string;
      approvedAt?: Date;
      rejectionReason?: string;
    }
  ) {
    return prisma.leaveRequest.update({
      where: { id },
      data,
      include: { leaveType: true, employee: true },
    });
  }

  async deductBalance(employeeId: string, leaveTypeId: string, year: number, days: number) {
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });
    if (!balance) return null;

    const usedDays = balance.usedDays + days;
    const remainingDays = balance.totalDays - usedDays;

    return prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { usedDays, remainingDays },
    });
  }

  async getUnpaidLeaveDays(
    companyId: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        employee: { companyId, deletedAt: null },
      },
      include: { leaveType: { select: { isPaid: true } } },
    });

    let totalUnpaid = 0;
    for (const req of requests) {
      if (!req.leaveType.isPaid) {
        const overlapStart = req.startDate > startDate ? req.startDate : startDate;
        const overlapEnd = req.endDate < endDate ? req.endDate : endDate;
        let days = 0;
        const cur = new Date(overlapStart);
        while (cur <= overlapEnd) {
          const dow = cur.getUTCDay();
          if (dow !== 0 && dow !== 6) days++;
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        totalUnpaid += days;
      }
    }
    return totalUnpaid;
  }

  async ensureBalances(employeeId: string, companyId: string, year: number) {
    const types = await prisma.leaveType.findMany({ where: { companyId } });
    for (const lt of types) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: lt.id,
            year,
          },
        },
        update: {},
        create: {
          employeeId,
          leaveTypeId: lt.id,
          year,
          totalDays: lt.daysPerYear,
          usedDays: 0,
          remainingDays: lt.daysPerYear,
        },
      });
    }
  }
}

export const leaveRepository = new LeaveRepository();
