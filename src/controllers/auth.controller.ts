import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { createAndSendToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    const user = await User.create({ name, email, password });
    logger.info(`New user registered: ${email}`);
    createAndSendToken(user, 201, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    logger.info(`User logged in: ${email}`);
    createAndSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) {
      return next(new AppError('User not found.', 404));
    }
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError('Please provide an email address.', 400));
    }

    const user = await User.findOne({ email });
    if (!user) {
      // SECURITY: Avoid leaking email existence, send success response
      sendResponseOk(res, 'If your email is registered, a reset link has been sent.');
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and set on user schema
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await (user as any).save({ validateBeforeSave: false });

    // Send email
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const message = `Forgot your password? Reset it here:\n\n${resetUrl}\n\nThis link is valid for 10 minutes. If you did not request a password reset, please ignore this email.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Trao Travel — Password Reset Link',
        message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #2563EB;">Trao AI Travel Planner</h2>
            <p>Hello ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to set a new one:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #64748b; font-size: 12px;">This link will expire in 10 minutes.</p>
            <p style="color: #64748b; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      sendResponseOk(res, 'If your email is registered, a reset link has been sent.');
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await (user as any).save({ validateBeforeSave: false });
      return next(new AppError('There was an error sending the email. Try again later.', 500));
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return next(new AppError('Token and password are required.', 400));
    }

    // Hash the token sent in body
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and valid expiry
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired.', 400));
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password successfully reset for: ${user.email}`);

    // Log the user in and return token
    createAndSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// Helper to keep response clean
const sendResponseOk = (res: Response, msg: string) => {
  res.status(200).json({ success: true, message: msg });
};

export const getCsrfToken = (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    csrfToken: (req as any).csrfToken || req.cookies['XSRF-TOKEN'],
  });
};

