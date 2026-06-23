import { Response, NextFunction } from 'express';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendResponse } from '../utils/response';
import {
  generateTripPlan,
  regenerateDayPlan,
  compareTwoDestinations,
  generateMoodPreview,
  generateConciergeReply,
  ConciergeUserProfile,
} from '../services/gemini.service';
import { getForecast } from '../services/weather.service';
import { logger } from '../utils/logger';

// POST /api/ai/generate-trip
export const generateTrip = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      destination,
      country,
      durationDays,
      budgetTier,
      travelStyle,
      interests,
      mood,
      startDate,
    } = req.body;

    // Create trip record with 'generating' status
    const trip = await Trip.create({
      userId: req.user!._id,
      destination,
      country,
      durationDays,
      budgetTier,
      travelStyle,
      interests,
      mood,
      startDate,
      status: 'generating',
    });

    logger.info(`Starting AI generation for trip ${trip._id}`);

    try {
      // Generate full trip plan via Gemini
      const aiResult = await generateTripPlan({
        destination,
        country,
        durationDays,
        budgetTier,
        travelStyle,
        interests,
        mood,
        startDate,
      });

      // Update trip with AI-generated content
      const updatedTrip = await Trip.findByIdAndUpdate(
        trip._id,
        {
          $set: {
            itinerary: aiResult.itinerary || [],
            estimatedBudget: aiResult.estimatedBudget || {},
            hotels: aiResult.hotels || [],
            packingList: aiResult.packingList || [],
            travelTips: aiResult.travelTips || [],
            foodsToTry: aiResult.foodsToTry || [],
            weatherSuggestions: aiResult.weatherSuggestions || [],
            safetyTips: aiResult.safetyTips || [],
            localEtiquette: aiResult.localEtiquette || [],
            routingInfo: aiResult.routingInfo || null,
            suggestedPlaces: aiResult.suggestedPlaces || [],
            status: 'completed',
          },
        },
        { new: true }
      );

      logger.info(`AI generation completed for trip ${trip._id}`);
      sendResponse(res, 201, { trip: updatedTrip }, 'Trip generated successfully!');
    } catch (aiError) {
      // Mark trip as failed
      await Trip.findByIdAndUpdate(trip._id, { status: 'failed' });
      throw aiError;
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/regenerate-day
export const regenerateDay = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tripId, dayNumber, preferences } = req.body;

    const trip = await Trip.findOne({
      _id: tripId,
      userId: req.user!._id, // SECURITY: enforce ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    if (dayNumber < 1 || dayNumber > trip.durationDays) {
      return next(new AppError(`Day ${dayNumber} is out of range for this ${trip.durationDays}-day trip.`, 400));
    }

    logger.info(`Regenerating Day ${dayNumber} for trip ${tripId}`);

    const regeneratedDay = await regenerateDayPlan({
      destination: trip.destination,
      country: trip.country,
      dayNumber,
      durationDays: trip.durationDays,
      budgetTier: trip.budgetTier,
      travelStyle: trip.travelStyle,
      interests: trip.interests,
      preferences,
      existingItinerary: trip.itinerary,
    });

    // Replace only the target day
    const dayIndex = trip.itinerary.findIndex((d) => d.day === dayNumber);
    if (dayIndex === -1) {
      trip.itinerary.push(regeneratedDay);
    } else {
      trip.itinerary[dayIndex] = regeneratedDay;
    }

    trip.markModified('itinerary');
    await trip.save();

    sendResponse(res, 200, { trip, regeneratedDay }, `Day ${dayNumber} regenerated successfully!`);
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/compare
export const compareDestinations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { destination1, destination2, budgetTier } = req.body;

    if (!destination1 || !destination2) {
      return next(new AppError('Both destinations are required.', 400));
    }

    const comparison = await compareTwoDestinations(
      destination1,
      destination2,
      budgetTier || 'medium'
    );

    sendResponse(res, 200, { comparison });
  } catch (error) {
    next(error);
  }
};

// GET /api/ai/weather/:tripId
export const getTripWeather = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      userId: req.user!._id, // SECURITY: Enforce ownership
    });

    if (!trip) {
      return next(new AppError('Trip not found or access denied.', 404));
    }

    const weather = await getForecast(trip.destination);
    sendResponse(res, 200, { weather });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/mood-preview
export const getMoodPreview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { destination, mood, budgetTier } = req.body;
    if (!destination || !mood) {
      return next(new AppError('Destination and mood are required.', 400));
    }

    const preview = await generateMoodPreview({
      destination,
      mood,
      budgetTier: budgetTier || 'medium',
    });

    sendResponse(res, 200, { preview });
  } catch (error) {
    next(error);
  }
};

// GET /api/ai/concierge/history
export const getConciergeHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const history = await Message.find({ userId: req.user!._id })
      .sort({ createdAt: 1 })
      .limit(50);
    sendResponse(res, 200, { history });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/concierge
export const handleConcierge = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message } = req.body;
    if (!message) {
      return next(new AppError('Message is required.', 400));
    }

    const userId = req.user!._id;

    // Load last 10 messages for conversation context
    const recentHistory = await Message.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Sort chronologically for the AI model
    const historyForAi = recentHistory.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Load user's trips for context
    const trips = await Trip.find({ userId, status: 'completed' });

    // Load user profile for personalization
    const userRecord = await User.findById(userId).lean();
    const userProfile: ConciergeUserProfile | undefined = userRecord ? {
      name: userRecord.name,
      defaultBudgetTier: userRecord.preferences?.defaultBudgetTier,
      defaultTravelStyle: userRecord.preferences?.defaultTravelStyle,
      totalTrips: userRecord.totalTrips,
      totalCountries: userRecord.totalCountries,
    } : undefined;

    // Save user's message
    const userMsgRecord = await Message.create({
      userId,
      role: 'user',
      content: message,
    });

    // Generate reply using AI service with full context
    const replyContent = await generateConciergeReply(message, historyForAi, trips, userProfile);

    // Save assistant's message
    const assistantMsgRecord = await Message.create({
      userId,
      role: 'assistant',
      content: replyContent,
    });

    sendResponse(res, 201, {
      userMessage: userMsgRecord,
      reply: replyContent,
      assistantMessage: assistantMsgRecord,
    }, 'Reply generated successfully!');
  } catch (error) {
    next(error);
  }
};
