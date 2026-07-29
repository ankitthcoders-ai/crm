import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export class DashboardRepository {
  async getSuperAdminStats(companyId: string) {
    const [
      totalEmployees,
      activeProjects,
      pendingLeaves,
      todayAttendance,
      recentActivities,
    ] = await Promise.all([
      prisma.employee.count({
        where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' },
      }),
      prisma.project.count({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
      }),
      prisma.leaveRequest.count({
        where: {
          employee: { companyId },
          status: 'PENDING',
        },
      }),
      prisma.attendance.count({
        where: {
          employee: { companyId },
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          status: { in: ['PRESENT', 'LATE', 'REMOTE'] },
        },
      }),
      prisma.auditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    const employeeGrowth = await prisma.$queryRaw<{ month: string; count: bigint }[]>(
      Prisma.sql`
        SELECT DATE_FORMAT(joining_date, '%b %Y') AS month,
               COUNT(*) AS count
        FROM employees
        WHERE company_id = ${companyId}
          AND deleted_at IS NULL
          AND joining_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY YEAR(joining_date), MONTH(joining_date), DATE_FORMAT(joining_date, '%b %Y')
        ORDER BY YEAR(joining_date), MONTH(joining_date)
      `
    );

    return {
      totalEmployees,
      activeProjects,
      pendingLeaves,
      todayAttendance,
      recentActivities,
      employeeGrowth: employeeGrowth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      revenue: { total: 0, growth: 0 },
      payrollExpenses: { total: 0, month: new Date().getMonth() + 1 },
    };
  }

  async getRoleStats(companyId: string, role: string, employeeId?: string | null) {
    const base = {
      employees: await prisma.employee.count({
        where: { companyId, deletedAt: null },
      }),
      projects: await prisma.project.count({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
      }),
      tasks: await prisma.task.count({
        where: {
          project: { companyId },
          deletedAt: null,
          status: { not: 'COMPLETED' },
        },
      }),
      notifications: await prisma.notification.count({
        where: { user: { companyId }, isRead: false },
      }),
    };

    if (role === 'HR') {
      return {
        ...base,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employee: { companyId }, status: 'PENDING' },
        }),
        newHires: await prisma.employee.count({
          where: {
            companyId,
            joiningDate: { gte: new Date(new Date().setDate(1)) },
          },
        }),
      };
    }

    if (role === 'MANAGER') {
      return {
        ...base,
        teamTasks: base.tasks,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employee: { companyId }, status: 'PENDING' },
        }),
      };
    }

    if (role === 'EMPLOYEE' && employeeId) {
      const assignedTasks = await prisma.task.findMany({
        where: {
          assigneeId: employeeId,
          deletedAt: null,
          status: { not: 'COMPLETED' },
        },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        ...base,
        myTasks: assignedTasks.length,
        assignedTasks,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employeeId, status: 'PENDING' },
        }),
        leaveBalance: 0,
      };
    }

    return {
      ...base,
      myTasks: base.tasks,
      pendingLeaves: 0,
      leaveBalance: 0,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
