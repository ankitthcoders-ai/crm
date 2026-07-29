import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { auditService, formatAuditActor } from './audit.service';

export class AdminUserService {
  async list(companyId: string, query: { page: number; limit: number; search?: string }) {
    const where = {
      companyId,
      deletedAt: null,
      ...(query.search && {
        OR: [
          { email: { contains: query.search } },
          { firstName: { contains: query.search } },
          { lastName: { contains: query.search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          employee: { select: { id: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);

    const auditMap = await auditService.getLatestForEntities(
      companyId,
      'User',
      items.map((item) => item.id)
    );

    return {
      items: items.map((user) => ({
        ...user,
        lastChange: auditMap.get(user.id) ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async update(
    companyId: string,
    actor: { id: string; email: string; firstName: string; lastName: string },
    userId: string,
    input: { roleId?: string; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' }
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const before = {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      roleId: user.roleId,
      roleName: user.role.name,
      status: user.status,
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.roleId !== undefined && { roleId: input.roleId }),
        ...(input.status !== undefined && { status: input.status }),
      },
      include: {
        role: true,
        employee: { select: { id: true, employeeCode: true } },
      },
    });

    await auditService.log({
      companyId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      oldValues: before,
      newValues: {
        email: updated.email,
        name: `${updated.firstName} ${updated.lastName}`.trim(),
        roleId: updated.roleId,
        roleName: updated.role.name,
        status: updated.status,
        updatedBy: formatAuditActor(actor),
      },
    });

    return updated;
  }

  async changePassword(
    companyId: string,
    actor: { id: string; email: string; firstName: string; lastName: string },
    userId: string,
    newPassword: string
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });
    if (!user) throw new NotFoundError('User not found');

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await auditService.log({
      companyId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      oldValues: { password: '***' },
      newValues: { password: '*** (changed by admin)', updatedBy: formatAuditActor(actor) },
    });
  }
}

export const adminUserService = new AdminUserService();
