import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IActivity {
  _id?: string;
  time: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  cost: number;
  category: string;
  tips?: string;
}

export interface IItineraryDay {
  day: number;
  date?: string;
  title: string;
  theme: string;
  activities: IActivity[];
  meals: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  accommodation?: string;
  estimatedDailyCost: number;
}

export interface IHotel {
  name: string;
  area: string;
  rating: number;
  priceRange: string;
  pricePerNight: number;
  tier: 'budget' | 'mid-range' | 'luxury';
  amenities: string[];
  whyRecommended: string;
  bookingTips?: string;
}

export interface IBudgetEstimation {
  flights: { min: number; max: number; currency: string };
  hotels: { min: number; max: number; currency: string };
  food: { min: number; max: number; currency: string };
  transport: { min: number; max: number; currency: string };
  activities: { min: number; max: number; currency: string };
  shopping: { min: number; max: number; currency: string };
  emergencyBuffer: { min: number; max: number; currency: string };
  total: { min: number; max: number; currency: string };
}

export interface IPackingItem {
  category: string;
  items: string[];
}

export interface ITransportOption {
  type: 'flight' | 'train' | 'bus' | 'road';
  description: string;
  duration?: string;
  estimatedCostRange?: string;
}

export interface IRoutingInfo {
  howToGetThere: ITransportOption[];
  localTransport: string[];
}

export interface IPlaceDetail {
  name: string;
  description: string;
  howToGo: string;
  bestTimeToVisit?: string;
}

export interface ISuggestedPlaces {
  category: string;
  places: IPlaceDetail[];
}

export interface ITrip extends Document {
  userId: Types.ObjectId;
  destination: string;
  country: string;
  durationDays: number;
  startDate?: string;
  budgetTier: 'low' | 'medium' | 'high';
  travelStyle: 'solo' | 'couple' | 'family' | 'friends';
  interests: string[];
  mood?: string;
  itinerary: IItineraryDay[];
  hotels: IHotel[];
  estimatedBudget: IBudgetEstimation;
  packingList: IPackingItem[];
  travelTips: string[];
  foodsToTry: Array<{ name: string; description: string; mustTry: boolean }>;
  weatherSuggestions: Array<{ season: string; description: string; packingTips: string[] }>;
  safetyTips: string[];
  localEtiquette: string[];
  routingInfo?: IRoutingInfo;
  suggestedPlaces?: ISuggestedPlaces[];
  shareToken?: string;
  isPublic: boolean;
  status: 'generating' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>({
  time: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  duration: { type: String, required: true },
  cost: { type: Number, default: 0 },
  category: { type: String, required: true },
  tips: { type: String },
});

const itineraryDaySchema = new Schema<IItineraryDay>({
  day: { type: Number, required: true },
  date: { type: String },
  title: { type: String, required: true },
  theme: { type: String, required: true },
  activities: [activitySchema],
  meals: {
    breakfast: { type: String },
    lunch: { type: String },
    dinner: { type: String },
  },
  accommodation: { type: String },
  estimatedDailyCost: { type: Number, default: 0 },
});

const hotelSchema = new Schema<IHotel>({
  name: { type: String, required: true },
  area: { type: String, required: true },
  rating: { type: Number, min: 1, max: 10, required: true },
  priceRange: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
  tier: { type: String, enum: ['budget', 'mid-range', 'luxury'], required: true },
  amenities: [{ type: String }],
  whyRecommended: { type: String, required: true },
  bookingTips: { type: String },
});

const transportOptionSchema = new Schema<ITransportOption>({
  type: { type: String, enum: ['flight', 'train', 'bus', 'road'], required: true },
  description: { type: String, required: true },
  duration: { type: String },
  estimatedCostRange: { type: String },
});

const routingInfoSchema = new Schema<IRoutingInfo>({
  howToGetThere: [transportOptionSchema],
  localTransport: [{ type: String }],
});

const placeDetailSchema = new Schema<IPlaceDetail>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  howToGo: { type: String, required: true },
  bestTimeToVisit: { type: String },
});

const suggestedPlacesSchema = new Schema<ISuggestedPlaces>({
  category: { type: String, required: true },
  places: [placeDetailSchema],
});

const tripSchema = new Schema<ITrip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    destination: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    durationDays: { type: Number, required: true, min: 1, max: 30 },
    startDate: { type: String },
    budgetTier: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    travelStyle: {
      type: String,
      enum: ['solo', 'couple', 'family', 'friends'],
      required: true,
    },
    interests: [{ type: String }],
    mood: { type: String },
    itinerary: [itineraryDaySchema],
    hotels: [hotelSchema],
    estimatedBudget: {
      flights: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      hotels: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      food: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      transport: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      activities: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      shopping: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      emergencyBuffer: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
      total: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
    },
    packingList: [
      {
        category: { type: String, required: true },
        items: [{ type: String }],
      },
    ],
    travelTips: [{ type: String }],
    foodsToTry: [
      {
        name: { type: String, required: true },
        description: { type: String, required: true },
        mustTry: { type: Boolean, default: false },
      },
    ],
    weatherSuggestions: [
      {
        season: { type: String, required: true },
        description: { type: String, required: true },
        packingTips: [{ type: String }],
      },
    ],
    safetyTips: [{ type: String }],
    localEtiquette: [{ type: String }],
    routingInfo: { type: routingInfoSchema },
    suggestedPlaces: [suggestedPlacesSchema],
    shareToken: { type: String, unique: true, sparse: true },
    isPublic: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ destination: 'text', country: 'text' });

export const Trip = mongoose.model<ITrip>('Trip', tripSchema);
