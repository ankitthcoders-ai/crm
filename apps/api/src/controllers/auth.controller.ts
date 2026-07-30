import { Response, CookieOptions } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
});

export class AuthController {
  async register(req: AuthenticatedRequest, res: Response) {
    const result = await authService.register(req.body);
    const { accessToken, refreshToken, user } = result;
    res.cookie('accessToken', accessToken, getCookieOptions());
    res.cookie('refreshToken', refreshToken, getCookieOptions());
    return sendCreated(res, { user, accessToken, refreshToken }, 'Registration successful');
  }

  async login(req: AuthenticatedRequest, res: Response) {
    const ip = req.ip;
    const userAgent = req.get('user-agent');
    const result = await authService.login(
      req.body.email,
      req.body.password,
      ip,
      userAgent
    );
    const { accessToken, refreshToken, user } = result;
    res.cookie('accessToken', accessToken, getCookieOptions());
    res.cookie('refreshToken', refreshToken, getCookieOptions());
    return sendSuccess(res, { user, accessToken, refreshToken }, 'Login successful');
  }

  async refresh(req: AuthenticatedRequest, res: Response) {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }
    const result = await authService.refresh(token);
    const { accessToken, refreshToken, user } = result;
    res.cookie('accessToken', accessToken, getCookieOptions());
    res.cookie('refreshToken', refreshToken, getCookieOptions());
    return sendSuccess(res, { user, accessToken, refreshToken }, 'Token refreshed');
  }

  async logout(req: AuthenticatedRequest, res: Response) {
    const token = req.cookies.refreshToken;
    await authService.logout(token, req.user?.id);
    res.clearCookie('accessToken', getCookieOptions());
    res.clearCookie('refreshToken', getCookieOptions());
    return sendSuccess(res, null, 'Logged out');
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response) {
    await authService.forgotPassword(req.body.email);
    return sendSuccess(res, null, 'If the email exists, a reset link was sent');
  }

  async resetPassword(req: AuthenticatedRequest, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    return sendSuccess(res, null, 'Password reset successful');
  }

  async verifyEmail(req: AuthenticatedRequest, res: Response) {
    await authService.verifyEmail(req.body.token);
    return sendSuccess(res, null, 'Email verified successfully');
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized');
    }
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    return sendSuccess(res, null, 'Password changed successfully');
  }

  async me(req: AuthenticatedRequest, res: Response) {
    const user = await authService.getMe(req.user!.id);
    return sendSuccess(res, user);
  }
}

export const authController = new AuthController();
