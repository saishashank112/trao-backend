import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const isTest = process.env.NODE_ENV === 'test';

export const globalLimiter = isTest
  ? (req: Request, res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      message: {
        success: false,
        status: 'fail',
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

export const authLimiter = isTest
  ? (req: Request, res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: {
        success: false,
        status: 'fail',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

export const aiLimiter = isTest
  ? (req: Request, res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.AI_RATE_LIMIT_MAX,
      message: {
        success: false,
        status: 'fail',
        message: 'AI generation limit reached. Please try again after 15 minutes.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

