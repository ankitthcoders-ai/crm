import { prisma } from '../config/database';
import {
  employeeRepository,
  departmentRepository,
  designationRepository,
} from '../repositories/employee.repository';
import { userRepository } from '../repositories/user.repository';
import { hashPassword } from '../utils/password';
import { auditService, formatAuditActor } from './audit.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

function employeeAuditSnapshot(emp: NonNullable<Awaited<ReturnType<typeof employeeRepository.findById>>>) {
  return {
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    email: emp.user.email,
    name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    managerId: emp.managerId,
    phone: emp.phone,
    employmentStatus: emp.employmentStatus,
  };
}

function mapEmployee(emp: NonNullable<Awaited<ReturnType<typeof employeeRepository.findById>>>) {
  return {
    id: emp.id,
    employeeCode: emp.employeeCode,
    employmentStatus: emp.employmentStatus,
    joiningDate: emp.joiningDate,
    phone: emp.phone,
    department: emp.department,
    designation: emp.designation,
    manager: emp.manager,
    user: emp.user,
    createdAt: emp.createdAt,
  };
}

export class EmployeeService {
  async list(
    user: NonNullable<AuthenticatedRequest['user']>,
    query: {
      page: number;
      limit: number;
      search?: string;
      departmentId?: string;
      status?: string;
    }
  ) {
    const { items, total } = await employeeRepository.findMany(user.companyId, query);
    const auditMap = await auditService.getLatestForEntities(
      user.companyId,
      'Employee',
      items.map((item) => item.id)
    );

    return {
      items: items.map((emp) => ({
        ...mapEmployee(emp),
        lastChange: auditMap.get(emp.id) ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const emp = await employeeRepository.findById(id, user.companyId);
    if (!emp) throw new NotFoundError('Employee not found');
    const auditMap = await auditService.getLatestForEntities(user.companyId, 'Employee', [id]);
    const history = await auditService.list(user.companyId, {
      entityType: 'Employee',
      entityId: id,
      limit: 10,
    });
    return {
      ...mapEmployee(emp),
      lastChange: auditMap.get(id) ?? null,
      auditHistory: history,
    };
  }

  async create(
    actor: NonNullable<AuthenticatedRequest['user']>,
    input: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
      employeeCode?: string;
      departmentId?: string;
      designationId?: string;
      joiningDate: string;
      phone?: string;
      employmentStatus?: string;
      managerId?: string;
      baseSalary?: number;
    }
  ) {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('Email already in use');

    const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
    if (!employeeRole) throw new ValidationError('EMPLOYEE role not found. Run seed.');

    const code = input.employeeCode ?? (await employeeRepository.getNextCode(actor.companyId));
    const codeTaken = await prisma.employee.findFirst({
      where: { companyId: actor.companyId, employeeCode: code, deletedAt: null },
    });
    if (codeTaken) throw new ConflictError('Employee code already exists');

    const passwordHash = await hashPassword(input.password ?? 'Password@123');
    const joiningDate = new Date(input.joiningDate);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          companyId: actor.companyId,
          roleId: employeeRole.id,
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: newUser.id,
          companyId: actor.companyId,
          employeeCode: code,
          departmentId: input.departmentId,
          designationId: input.designationId,
          joiningDate,
          phone: input.phone,
          employmentStatus: (input.employmentStatus as 'ACTIVE') ?? 'ACTIVE',
          managerId: input.managerId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              avatarUrl: true,
            },
          },
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, title: true, level: true } },
          manager: true,
        },
      });

      if (input.baseSalary !== undefined && input.baseSalary !== null) {
        await tx.salaryStructure.create({
          data: {
            employeeId: employee.id,
            baseSalary: input.baseSalary,
            effectiveFrom: joiningDate,
          },
        });
      }

      return employee;
    });

    const full = await employeeRepository.findById(result.id, actor.companyId);

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: result.id,
      newValues: {
        ...employeeAuditSnapshot(full!),
        createdBy: formatAuditActor(actor),
      },
    });

    return mapEmployee(full!);
  }

  async update(
    actor: NonNullable<AuthenticatedRequest['user']>,
    id: string,
    input: {
      firstName?: string;
      lastName?: string;
      departmentId?: string | null;
      designationId?: string | null;
      phone?: string | null;
      employmentStatus?: string;
      managerId?: string | null;
    }
  ) {
    const emp = await employeeRepository.findById(id, actor.companyId);
    if (!emp) throw new NotFoundError('Employee not found');

    const before = employeeAuditSnapshot(emp);

    if (input.firstName || input.lastName) {
      await userRepository.update(emp.userId, {
        ...(input.firstName && { firstName: input.firstName }),
        ...(input.lastName && { lastName: input.lastName }),
      });
    }

    const updated = await employeeRepository.update(id, {
      ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
      ...(input.designationId !== undefined && { designationId: input.designationId }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.employmentStatus && {
        employmentStatus: input.employmentStatus as 'ACTIVE',
      }),
      ...(input.managerId !== undefined && { managerId: input.managerId }),
    });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: id,
      oldValues: before,
      newValues: {
        ...employeeAuditSnapshot(updated),
        updatedBy: formatAuditActor(actor),
      },
    });

    return mapEmployee(updated);
  }

  async remove(actor: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const emp = await employeeRepository.findById(id, actor.companyId);
    if (!emp) throw new NotFoundError('Employee not found');
    if (emp.userId === actor.id) throw new ForbiddenError('Cannot delete your own record');

    const before = employeeAuditSnapshot(emp);

    await employeeRepository.softDelete(id);
    await userRepository.update(emp.userId, { status: 'INACTIVE' });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: id,
      oldValues: before,
      newValues: {
        deletedBy: formatAuditActor(actor),
        targetUserId: emp.userId,
        targetEmail: emp.user.email,
      },
    });

    await auditService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: emp.userId,
      oldValues: {
        email: emp.user.email,
        name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
        employeeId: emp.id,
      },
      newValues: {
        deletedBy: formatAuditActor(actor),
      },
    });
  }

  async listDepartments(companyId: string) {
    return departmentRepository.findByCompany(companyId);
  }

  async createDepartment(
    actor: NonNullable<AuthenticatedRequest['user']>,
    data: { name: string; code?: string; description?: string }
  ) {
    return departmentRepository.create(actor.companyId, data);
  }

  async listDesignations(companyId: string) {
    return designationRepository.findByCompany(companyId);
  }

  async createDesignation(
    actor: NonNullable<AuthenticatedRequest['user']>,
    data: { title: string; level: number; description?: string }
  ) {
    return designationRepository.create(actor.companyId, data);
  }
}

export const employeeService = new EmployeeService();
