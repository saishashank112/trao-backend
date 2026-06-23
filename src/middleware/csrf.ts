import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Bypass CSRF check in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // 1. Safe methods do not require CSRF protection
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  
  // Set XSRF-TOKEN cookie if it doesn't exist
  if (!req.cookies['XSRF-TOKEN']) {
    const token = crypto.randomBytes(24).toString('hex');
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Must be accessible by client JS (Axios)
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    (req as any).csrfToken = token;
  } else {
    (req as any).csrfToken = req.cookies['XSRF-TOKEN'];
  }

  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 2. Validate token for mutating methods
  const clientToken = req.headers['x-xsrf-token'] as string;
  const cookieToken = req.cookies['XSRF-TOKEN'];

  if (!clientToken || !cookieToken || clientToken !== cookieToken) {
    res.status(403).json({
      success: false,
      status: 'fail',
      message: 'CSRF token mismatch. Action denied.',
    });
    return;
  }

  next();
};

