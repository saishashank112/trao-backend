import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env';
import { IUser } from '../models/User';
import type { StringValue } from 'ms';

export const signToken = (id: string): string => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  });
};

export const createAndSendToken = (user: IUser, statusCode: number, res: Response): void => {
  const token = signToken(String(user._id));

  const cookieOptions = {
    expires: new Date(Date.now() + env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  };

  res.cookie('jwt', token, cookieOptions);

  const userObj = user.toObject() as any;
  delete userObj.password;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user: userObj,
    },
  });
};
