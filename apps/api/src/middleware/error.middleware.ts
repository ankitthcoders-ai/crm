import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      statusCode: err.statusCode,
    });
    return;
  }

  if (err.name === 'PrismaClientKnownRequestError' && (err as any).code === 'P2002') {
    res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists',
      statusCode: 409,
    });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    statusCode: 500,
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    statusCode: 404,
  });
}
