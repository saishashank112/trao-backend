import { z } from 'zod';

export const createTripSchema = z.object({
  destination: z
    .string({ required_error: 'Destination is required' })
    .min(2, 'Destination must be at least 2 characters')
    .max(100, 'Destination cannot exceed 100 characters')
    .trim(),
  country: z
    .string({ required_error: 'Country is required' })
    .min(2, 'Country must be at least 2 characters')
    .max(100, 'Country cannot exceed 100 characters')
    .trim(),
  durationDays: z
    .number({ required_error: 'Duration is required' })
    .int('Duration must be a whole number')
    .min(1, 'Minimum 1 day')
    .max(30, 'Maximum 30 days'),
  startDate: z.string().optional(),
  budgetTier: z.enum(['low', 'medium', 'high'], {
    required_error: 'Budget tier is required',
  }),
  travelStyle: z.enum(['solo', 'couple', 'family', 'friends'], {
    required_error: 'Travel style is required',
  }),
  interests: z
    .array(z.string())
    .min(1, 'Select at least one interest')
    .max(10, 'Cannot select more than 10 interests'),
  mood: z.string().optional(),
});

export const updateTripSchema = z.object({
  destination: z.string().min(2).max(100).trim().optional(),
  durationDays: z.number().int().min(1).max(30).optional(),
  startDate: z.string().optional(),
  itinerary: z.array(z.any()).optional(),
  travelTips: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const addActivitySchema = z.object({
  day: z.number({ required_error: 'Day is required' }).int().min(1),
  activity: z.object({
    time: z.string({ required_error: 'Time is required' }),
    title: z.string({ required_error: 'Title is required' }).min(2).max(200),
    description: z.string({ required_error: 'Description is required' }).min(5).max(1000),
    location: z.string({ required_error: 'Location is required' }).min(2).max(200),
    duration: z.string({ required_error: 'Duration is required' }),
    cost: z.number().min(0).default(0),
    category: z.string({ required_error: 'Category is required' }),
    tips: z.string().optional(),
  }),
});

export const regenerateDaySchema = z.object({
  tripId: z.string({ required_error: 'Trip ID is required' }),
  dayNumber: z.number({ required_error: 'Day number is required' }).int().min(1).max(30),
  preferences: z.string().optional(),
});

export const updateActivitySchema = z.object({
  day: z.number({ required_error: 'Day is required' }).int().min(1),
  activity: z.object({
    time: z.string().optional(),
    title: z.string().min(2).max(200).optional(),
    description: z.string().min(5).max(1000).optional(),
    location: z.string().min(2).max(200).optional(),
    duration: z.string().optional(),
    cost: z.number().min(0).optional(),
    category: z.string().optional(),
    tips: z.string().optional(),
  }),
});
