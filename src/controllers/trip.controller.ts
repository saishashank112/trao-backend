import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { enrichTripPlan } from '../services/gemini.service';

// GET /api/trips
export const getTrips = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [trips, total] = await Promise.all([
      Trip.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Trip.countDocuments({ userId }),
    ]);

    sendResponse(res, 200, {
      trips,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/trips/:id
export const getTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      userId: req.user!._id, // SECURITY: enforce user ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    sendResponse(res, 200, { trip });
  } catch (error) {
    next(error);
  }
};

// POST /api/trips
export const createTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tripData = {
      ...req.body,
      userId: req.user!._id,
      status: 'generating',
    };

    const trip = await Trip.create(tripData);

    // Update user stats
    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { totalTrips: 1 },
    });

    sendResponse(res, 201, { trip }, 'Trip created successfully.');
  } catch (error) {
    next(error);
  }
};

// PUT /api/trips/:id
export const updateTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id }, // SECURITY: enforce user ownership
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    sendResponse(res, 200, { trip }, 'Trip updated successfully.');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/trips/:id
export const deleteTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!._id, // SECURITY: enforce user ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { totalTrips: -1 },
    });

    sendResponse(res, 200, null, 'Trip deleted successfully.');
  } catch (error) {
    next(error);
  }
};

// POST /api/trips/:id/activity
export const addActivity = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { day, activity } = req.body;

    const trip = await Trip.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    const dayIndex = trip.itinerary.findIndex((d) => d.day === day);
    if (dayIndex === -1) {
      return next(new AppError(`Day ${day} not found in itinerary.`, 404));
    }

    trip.itinerary[dayIndex].activities.push(activity);
    await trip.save();

    sendResponse(res, 201, { trip }, 'Activity added successfully.');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/trips/:id/activity/:activityId
export const deleteActivity = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { day } = req.query;
    const { activityId } = req.params;

    const trip = await Trip.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    let dayIndex = -1;
    if (day !== undefined && day !== '') {
      dayIndex = trip.itinerary.findIndex((d) => d.day === parseInt(day as string));
    } else {
      // Fallback: Scan itinerary to find which day contains the activity
      dayIndex = trip.itinerary.findIndex((d) =>
        d.activities.some((a) => a._id?.toString() === activityId)
      );
    }

    if (dayIndex === -1) {
      return next(new AppError(`Day not found.`, 404));
    }

    trip.itinerary[dayIndex].activities = trip.itinerary[dayIndex].activities.filter(
      (a) => a._id?.toString() !== activityId
    );

    await trip.save();
    sendResponse(res, 200, { trip }, 'Activity deleted successfully.');
  } catch (error) {
    next(error);
  }
};


// POST /api/trips/:id/share
export const shareTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    if (!trip.shareToken) {
      trip.shareToken = uuidv4();
    }
    trip.isPublic = true;
    await trip.save();

    sendResponse(res, 200, { shareToken: trip.shareToken, isPublic: true }, 'Share link generated.');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/trips/:id/share
export const unshareTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { isPublic: false },
      { new: true }
    );

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    sendResponse(res, 200, { isPublic: false }, 'Trip sharing disabled.');
  } catch (error) {
    next(error);
  }
};

// GET /api/trips/shared/:token (public)
export const getSharedTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOne({
      shareToken: req.params.token,
      isPublic: true,
    }).lean();

    if (!trip) {
      return next(new AppError('Shared trip not found or link has been disabled.', 404));
    }

    sendResponse(res, 200, { trip });
  } catch (error) {
    next(error);
  }
};

// GET /api/trips/stats
export const getTripStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;

    // Count ALL trips for the user (any status)
    const [totalTrips, completedTrips] = await Promise.all([
      Trip.countDocuments({ userId }),
      Trip.find(
        { userId, status: 'completed' },
        'destination country estimatedBudget durationDays createdAt'
      ).lean(),
    ]);

    const destinations = [...new Set(completedTrips.map((t) => t.country))];
    const totalDays = completedTrips.reduce((acc, t) => acc + t.durationDays, 0);

    const destinationFrequency = completedTrips.reduce((acc: Record<string, number>, t) => {
      acc[t.destination] = (acc[t.destination] || 0) + 1;
      return acc;
    }, {});

    const topDestination =
      Object.entries(destinationFrequency).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    sendResponse(res, 200, {
      totalTrips,
      totalCountries: destinations.length,
      totalDays,
      topDestination,
      recentTrips: completedTrips.slice(0, 5),
      destinationFrequency,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/trips/:id/activity/:activityId
export const updateActivity = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { day, activity } = req.body;
    const { id, activityId } = req.params;

    const trip = await Trip.findOne({
      _id: id,
      userId: req.user!._id, // SECURITY: Enforce ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    const dayIndex = trip.itinerary.findIndex((d) => d.day === day);
    if (dayIndex === -1) {
      return next(new AppError(`Day ${day} not found in itinerary.`, 404));
    }

    const activityIndex = trip.itinerary[dayIndex].activities.findIndex(
      (a) => a._id?.toString() === activityId
    );

    if (activityIndex === -1) {
      return next(new AppError(`Activity not found on Day ${day}.`, 404));
    }

    // Merge updates
    const currentActivity = trip.itinerary[dayIndex].activities[activityIndex];
    Object.assign(currentActivity, activity);

    await trip.save();

    sendResponse(res, 200, { trip }, 'Activity updated successfully.');
  } catch (error) {
    next(error);
  }
};

// POST /api/trips/:id/enrich
export const enrichTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const trip = await Trip.findOne({
      _id: id,
      userId: req.user!._id, // SECURITY: enforce ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    logger.info(`Starting AI enrichment for trip ${id}`);

    const enrichData = await enrichTripPlan(trip.destination, trip.country);

    trip.routingInfo = enrichData.routingInfo || null;
    trip.suggestedPlaces = enrichData.suggestedPlaces || [];

    await trip.save();

    logger.info(`AI enrichment completed for trip ${id}`);
    sendResponse(res, 200, { trip }, 'Trip enriched with routing and suggested places successfully!');
  } catch (error) {
    next(error);
  }
};
