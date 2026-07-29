import { Router } from 'express';
import { ROLES } from '@crm/shared';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { adminUserController } from '../controllers/admin-user.controller';
import { listAdminUsersSchema, updateAdminUserSchema, adminChangePasswordSchema } from '../validators/admin-user.validator';

const router = Router();
router.use(authenticate);
router.use(requireRoles(ROLES.SUPER_ADMIN, ROLES.HR));

router.get('/', validate(listAdminUsersSchema, 'query'), (req, res, next) =>
  adminUserController.list(req, res).catch(next)
);

router.patch('/:id', validate(updateAdminUserSchema), (req, res, next) =>
  adminUserController.update(req, res).catch(next)
);

router.post('/:id/change-password', validate(adminChangePasswordSchema), (req, res, next) =>
  adminUserController.adminChangePassword(req, res).catch(next)
);

export default router;
