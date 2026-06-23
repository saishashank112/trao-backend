import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendResponse } from '../utils/response';

// GET /api/profile
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) return next(new AppError('User not found.', 404));

    const [tripCount, recentTrips] = await Promise.all([
      Trip.countDocuments({ userId: req.user!._id, status: 'completed' }),
      Trip.find({ userId: req.user!._id, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('destination country durationDays budgetTier createdAt')
        .lean(),
    ]);

    sendResponse(res, 200, { user, stats: { tripCount, recentTrips } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/profile
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowedFields = ['name', 'avatar', 'preferences', 'phone', 'bio', 'location', 'gender', 'dateOfBirth'];
    const updates: Record<string, any> = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle nested preferences update
    if (req.body.preferences) {
      const user = await User.findById(req.user!._id).lean();
      if (user) {
        updates.preferences = { ...user.preferences, ...req.body.preferences };
      }
    }

    const user = await User.findByIdAndUpdate(req.user!._id, { $set: updates }, { new: true, runValidators: true });

    if (!user) return next(new AppError('User not found.', 404));

    sendResponse(res, 200, { user }, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
};

// PUT /api/profile/password
export const updatePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) return next(new AppError('User not found.', 404));

    const isCorrect = await user.comparePassword(currentPassword);
    if (!isCorrect) return next(new AppError('Current password is incorrect.', 401));

    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters.', 400));
    }

    user.password = newPassword;
    await user.save();

    sendResponse(res, 200, null, 'Password updated successfully.');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/profile
export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user!._id).select('+password');
    if (!user) return next(new AppError('User not found.', 404));

    const isCorrect = await user.comparePassword(password);
    if (!isCorrect) return next(new AppError('Incorrect password. Account deletion cancelled.', 401));

    // Delete all trips
    await Trip.deleteMany({ userId: req.user!._id });
    await User.findByIdAndDelete(req.user!._id);

    res.cookie('jwt', 'deleted', { expires: new Date(0), httpOnly: true });
    sendResponse(res, 200, null, 'Account deleted successfully.');
  } catch (error) {
    next(error);
  }
};
