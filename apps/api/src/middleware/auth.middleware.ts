import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: string;
    permissions: string[];
    employeeId?: string;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookieToken = req.cookies.accessToken;
    const header = req.headers.authorization;
    
    let token = cookieToken;
    if (!token && header?.startsWith('Bearer ')) {
      token = header.slice(7);
    }

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);

    if (!user || user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new UnauthorizedError('Invalid session');
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
      employeeId: user.employee?.id,
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) next(error);
    else next(new UnauthorizedError('Invalid or expired token'));
  }
}
