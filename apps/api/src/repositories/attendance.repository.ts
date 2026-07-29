import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { calendarDateOnly } from '../utils/date';
import { getMonthDateRange } from '../utils/working-days';

export class AttendanceRepository {
  async findToday(employeeId: string) {
    return prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId, date: calendarDateOnly() },
      },
    });
  }

  async findMany(
    companyId: string,
    opts: {
      page: number;
      limit: number;
      employeeId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const dateFilter: Prisma.DateTimeFilter | undefined =
      opts.startDate || opts.endDate
        ? {
            ...(opts.startDate && { gte: new Date(opts.startDate) }),
            ...(opts.endDate && { lte: new Date(opts.endDate) }),
          }
        : undefined;

    const where: Prisma.AttendanceWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(opts.employeeId && { employeeId: opts.employeeId }),
      ...(dateFilter && { date: dateFilter }),
    };

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return { items, total };
  }

  async getMonthlySummary(
    companyId: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<{
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    halfDays: number;
  }> {
    const { startDate, endDate } = getMonthDateRange(year, month);

    const records = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
        employee: { companyId, deletedAt: null },
      },
    });

    let presentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;
    let halfDays = 0;

    for (const r of records) {
      switch (r.status) {
        case 'PRESENT':
        case 'REMOTE':
          presentDays++;
          break;
        case 'LATE':
          lateDays++;
          presentDays++;
          break;
        case 'HALF_DAY':
          halfDays++;
          break;
        case 'ON_LEAVE':
          leaveDays++;
          break;
      }
    }

    return { presentDays: presentDays + lateDays + halfDays, absentDays: 0, lateDays, leaveDays, halfDays };
  }

  async createCheckIn(
    employeeId: string,
    data: { checkIn: Date; lat?: number; lng?: number; notes?: string; isLate?: boolean; lateMinutes?: number }
  ) {
    return prisma.attendance.create({
      data: {
        employeeId,
        date: calendarDateOnly(),
        checkIn: data.checkIn,
        status: data.isLate ? 'LATE' : 'PRESENT',
        checkInLat: data.lat,
        checkInLng: data.lng,
        notes: data.notes,
        isLate: data.isLate ?? false,
        lateMinutes: data.lateMinutes,
      },
      include: {
        employee: {
          select: {
            employeeCode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async updateCheckOut(
    id: string,
    data: { checkOut: Date; workHours: number; overtimeHours: number; notes?: string }
  ) {
    return prisma.attendance.update({
      where: { id },
      data: {
        checkOut: data.checkOut,
        workHours: data.workHours,
        overtimeHours: data.overtimeHours,
        notes: data.notes,
      },
    });
  }
}

export const attendanceRepository = new AttendanceRepository();
