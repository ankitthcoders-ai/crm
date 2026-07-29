import { holidayRepository } from '../repositories/holiday.repository';
import { auditService } from './audit.service';
import { NotificationService } from './notification.service';
import { NotFoundError } from '../utils/errors';
import { prisma } from '../config/database';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

const notificationService = new NotificationService();

export class HolidayService {
  async list(companyId: string) {
    return holidayRepository.findByCompany(companyId);
  }

  async create(
    user: NonNullable<AuthenticatedRequest['user']>,
    input: { name: string; date: string; isOptional?: boolean }
  ) {
    const holiday = await holidayRepository.create(user.companyId, {
      name: input.name,
      date: new Date(input.date),
      isOptional: input.isOptional,
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Holiday',
      entityId: holiday.id,
    });

    // Notify all employees about the new holiday
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: { userId: true },
    });

    for (const emp of employees) {
      await notificationService.createNotification(
        emp.userId,
        'SYSTEM',
        'New Holiday Added',
        `${input.name} on ${new Date(input.date).toLocaleDateString()} has been added to the holiday calendar.`
      ).catch(err => console.error('Failed to send holiday notification', err));
    }

    return holiday;
  }

  async delete(user: NonNullable<AuthenticatedRequest['user']>, id: string) {
    const holiday = await holidayRepository.findById(id, user.companyId);
    if (!holiday) throw new NotFoundError('Holiday not found');

    await holidayRepository.delete(id);

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'DELETE',
      entityType: 'Holiday',
      entityId: id,
    });
  }
}

export const holidayService = new HolidayService();
