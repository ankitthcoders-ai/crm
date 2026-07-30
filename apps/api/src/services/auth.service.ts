import { v4 as uuidv4 } from 'uuid';
import type { AuthUser } from '@crm/shared';
import { userRepository } from '../repositories/user.repository';
import { authRepository } from '../repositories/auth.repository';
import { companyRepository } from '../repositories/company.repository';
import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  parseExpiresIn,
} from '../utils/jwt';
import { env } from '../config/env';
import { auditService } from './audit.service';
import { emailService } from './email.service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapUserToAuthUser(user: NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>): AuthUser {
  const permissions = user.role.permissions.map((rp) => rp.permission.key);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name as AuthUser['role'],
    permissions,
    companyId: user.companyId,
    employeeId: user.employee?.id,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

export class AuthService {
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) {
    const email = input.email.toLowerCase();
    const existing = await userRepository.existsByEmail(email);
    if (existing) throw new ConflictError('Email already registered');

    let slug = slugify(input.companyName);
    const slugExists = await companyRepository.findBySlug(slug);
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });
    if (!superAdminRole) {
      throw new ValidationError('System roles not initialized. Run database seed.');
    }

    const passwordHash = await hashPassword(input.password);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.companyName,
          slug,
          settings: { create: {} },
          subscription: {
            create: {
              plan: 'FREE',
              status: 'TRIAL',
              maxUsers: 50,
              maxProjects: 20,
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      await tx.department.createMany({
        data: [
          { companyId: company.id, name: 'Engineering', code: 'ENG' },
          { companyId: company.id, name: 'Human Resources', code: 'HR' },
          { companyId: company.id, name: 'Sales', code: 'SALES' },
          { companyId: company.id, name: 'Marketing', code: 'MKT' },
        ],
      });

      await tx.designation.createMany({
        data: [
          { companyId: company.id, title: 'Manager', level: 3 },
          { companyId: company.id, title: 'Software Engineer', level: 2 },
          { companyId: company.id, title: 'HR Specialist', level: 2 },
          { companyId: company.id, title: 'Sales Executive', level: 2 },
        ],
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          companyId: company.id,
          roleId: superAdminRole.id,
          status: 'PENDING_VERIFICATION',
        },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          employee: true,
        },
      });

      await tx.employee.create({
        data: {
          userId: user.id,
          companyId: company.id,
          employeeCode: 'EMP-0001',
          joiningDate: new Date(),
        },
      });

      return user;
    }, { timeout: 15000 });

    const verifyToken = uuidv4();
    await authRepository.createEmailVerification(
      result.id,
      verifyToken,
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
    await emailService.sendVerificationEmail(email, verifyToken);

    const tokens = await this.issueTokens(result);
    return { user: mapUserToAuthUser(result), ...tokens };
  }

  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedError('Email is not registered');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Incorrect password');

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new UnauthorizedError('Account is disabled');
    }

    await userRepository.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, ip, userAgent);

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    });

    return { user: mapUserToAuthUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const stored = await authRepository.findRefreshToken(refreshToken);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) throw new UnauthorizedError('User not found');

    await authRepository.revokeRefreshToken(refreshToken);
    const tokens = await this.issueTokens(user);
    return { user: mapUserToAuthUser(user), ...tokens };
  }

  async logout(refreshToken: string | undefined, userId?: string) {
    if (refreshToken) {
      await authRepository.revokeRefreshToken(refreshToken).catch(() => null);
    }
    if (userId) {
      await authRepository.revokeAllUserTokens(userId);
    }
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user) return;

    const token = uuidv4();
    await authRepository.createPasswordReset(
      user.id,
      token,
      new Date(Date.now() + 60 * 60 * 1000)
    );
    await emailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await authRepository.findPasswordReset(token);
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.update(reset.userId, { passwordHash });
    await authRepository.markPasswordResetUsed(reset.id);
    await authRepository.revokeAllUserTokens(reset.userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User not found');

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Incorrect current password');

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await auditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      oldValues: { password: '***' },
      newValues: { password: '*** (changed by user)' },
    });
  }

  async verifyEmail(token: string) {
    const verification = await authRepository.findEmailVerification(token);
    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await userRepository.update(verification.userId, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
    });
    await authRepository.markEmailVerificationUsed(verification.id);
  }

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return mapUserToAuthUser(user);
  }

  private async issueTokens(
    user: NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>,
    ip?: string,
    userAgent?: string
  ) {
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role.name,
    });
    const refreshToken = signRefreshToken({ sub: user.id });
    const expiresAt = parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN);

    await authRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    await authRepository.createSession(
      user.id,
      parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN),
      ip,
      userAgent
    );

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
