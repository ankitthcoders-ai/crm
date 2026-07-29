import { Response } from 'express';
import { holidayService } from '../services/holiday.service';
import { sendSuccess, sendCreated } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class HolidayController {
  async list(req: AuthenticatedRequest, res: Response) {
    const data = await holidayService.list(req.user!.companyId);
    return sendSuccess(res, data);
  }

  async create(req: AuthenticatedRequest, res: Response) {
    const data = await holidayService.create(req.user!, req.body);
    return sendCreated(res, data, 'Holiday created');
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await holidayService.delete(req.user!, id);
    return sendSuccess(res, null, 'Holiday deleted');
  }
}

export const holidayController = new HolidayController();
