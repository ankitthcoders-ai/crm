import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register company and super admin
 */
router.post('/register', validate(registerSchema), (req, res, next) =>
  authController.register(req, res).catch(next)
);

router.post('/login', validate(loginSchema), (req, res, next) =>
  authController.login(req, res).catch(next)
);

router.post('/refresh', validate(refreshSchema), (req, res, next) =>
  authController.refresh(req, res).catch(next)
);

router.post('/logout', validate(refreshSchema), (req, res, next) =>
  authController.logout(req, res).catch(next)
);

router.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) =>
  authController.forgotPassword(req, res).catch(next)
);

router.post('/reset-password', validate(resetPasswordSchema), (req, res, next) =>
  authController.resetPassword(req, res).catch(next)
);

router.post('/verify-email', validate(verifyEmailSchema), (req, res, next) =>
  authController.verifyEmail(req, res).catch(next)
);

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res).catch(next)
);

router.post('/change-password', authenticate, validate(changePasswordSchema), (req, res, next) =>
  authController.changePassword(req, res).catch(next)
);

export default router;
