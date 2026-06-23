import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let isUsingFallback = false;

export const connectDB = async (): Promise<void> => {
  // First, try the configured MongoDB URI (Atlas)
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    isUsingFallback = false;

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnect...');
    });

    return;
  } catch (atlasError: any) {
    logger.error('❌ MongoDB Atlas connection FAILED!');
    logger.error(`   Reason: ${atlasError?.message || atlasError}`);
    logger.error('');
    logger.error('   ⚠️  ACTION REQUIRED — Fix your MongoDB Atlas credentials:');
    logger.error('   ────────────────────────────────────────────────────────');
    logger.error('   1. Open: https://cloud.mongodb.com');
    logger.error('   2. Go to: Database Access → Edit user "saishashankallampally_db_user"');
    logger.error('   3. Click "Edit Password" → Generate a new password → Save');
    logger.error('   4. Update MONGODB_URI in backend/.env with the new password');
    logger.error('   5. Also go to: Network Access → Add IP Address → Allow from Anywhere (0.0.0.0/0)');
    logger.error('   ────────────────────────────────────────────────────────');
    logger.error('');
  }

  // Fallback to local in-memory MongoDB (development only)
  if (process.env.NODE_ENV === 'development') {
    logger.warn('⚠️  USING LOCAL IN-MEMORY DATABASE — Data will be lost on server restart!');
    logger.warn('   Fix your MongoDB Atlas credentials to persist data permanently.');
    logger.warn('');
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();

      const conn = await mongoose.connect(mongoUri);
      isUsingFallback = true;
      logger.info(`🗄️  Connected to temporary in-memory MongoDB: ${conn.connection.host}`);
      logger.info('   ⚠️  ALL DATA WILL BE LOST WHEN THE SERVER RESTARTS');

      mongoose.connection.on('error', (err) => {
        logger.error(`MongoDB Fallback error: ${err}`);
      });

      return;
    } catch (fallbackError: any) {
      logger.error(`Failed to start in-memory MongoDB: ${fallbackError?.message}`);
    }
  }

  logger.error('Could not connect to any MongoDB instance. Exiting.');
  process.exit(1);
};
