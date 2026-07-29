import { Response } from 'express';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { adminUserService } from '../services/admin-user.service';
import { UnauthorizedError } from '../utils/errors';

export class AdminUserController {
  async list(req: AuthenticatedRequest, res: Response) {
    const result = await adminUserService.list(req.user!.companyId, req.query as never);
    return sendPaginated(res, result.items, result.meta);
  }

  async update(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await adminUserService.update(req.user!.companyId, req.user!, id, req.body);
    return sendSuccess(res, data, 'User updated successfully');
  }

  async adminChangePassword(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.companyId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const { newPassword } = req.body;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await adminUserService.changePassword(
      req.user.companyId,
      req.user,
      id,
      newPassword
    );
    return sendSuccess(res, null, 'Password changed successfully');
  }
}

export const adminUserController = new AdminUserController();
