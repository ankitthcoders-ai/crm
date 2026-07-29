import { prisma } from '../config/database';

export class HolidayRepository {
  async findByCompany(companyId: string) {
    return prisma.holiday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    });
  }

  async findById(id: string, companyId: string) {
    return prisma.holiday.findFirst({
      where: { id, companyId },
    });
  }

  async create(companyId: string, data: { name: string; date: Date; isOptional?: boolean }) {
    return prisma.holiday.create({
      data: {
        companyId,
        ...data,
      },
    });
  }

  async delete(id: string) {
    return prisma.holiday.delete({
      where: { id },
    });
  }
}

export const holidayRepository = new HolidayRepository();
