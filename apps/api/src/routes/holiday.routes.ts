import { Router } from 'express';
import { holidayController } from '../controllers/holiday.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { PERMISSIONS } from '@crm/shared';
import { createHolidaySchema } from '../validators/holiday.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  (req, res, next) => holidayController.list(req, res).catch(next)
);

router.post(
  '/',
  requireAnyPermission(PERMISSIONS.LEAVES_APPROVE),
  validate(createHolidaySchema),
  (req, res, next) => holidayController.create(req, res).catch(next)
);

router.delete(
  '/:id',
  requireAnyPermission(PERMISSIONS.LEAVES_APPROVE),
  (req, res, next) => holidayController.delete(req, res).catch(next)
);

export default router;
