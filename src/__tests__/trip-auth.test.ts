import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { MongoMemoryServer } from 'mongodb-memory-server';

const testUser = {
  name: 'Trip Test User',
  email: 'triptest@example.com',
  password: 'Password123',
};

const anotherUser = {
  name: 'Another User',
  email: 'another@example.com',
  password: 'Password123',
};

describe('Trip Authorization Tests', () => {
  let token: string;
  let anotherToken: string;
  let tripId: string;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    } catch (err) {
      console.warn('⚠️ Failed to start MongoMemoryServer, falling back to Atlas Test DB');
      const atlasUri = process.env.MONGODB_URI;
      if (!atlasUri) {
        throw new Error('MONGODB_URI not found in env for fallback connection');
      }
      const testUri = atlasUri.replace('/trao?', '/trao_test?');
      await mongoose.connect(testUri);
    }
  });

  afterAll(async () => {
    try {
      await User.deleteMany({});
      await Trip.deleteMany({});
      await mongoose.disconnect();
      if (mongoServer) {
        await mongoServer.stop();
      }
    } catch (err) {
      console.error('Error during teardown:', err);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Trip.deleteMany({});

    const res1 = await request(app).post('/api/auth/register').send(testUser);
    token = res1.body.token;

    const res2 = await request(app).post('/api/auth/register').send(anotherUser);
    anotherToken = res2.body.token;

    // Create a trip for the first user
    const tripRes = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destination: 'Tokyo',
        country: 'Japan',
        durationDays: 5,
        budgetTier: 'medium',
        travelStyle: 'solo',
        interests: ['food', 'culture'],
      });
    tripId = tripRes.body.data.trip._id;
  });

  it('should NOT allow user to access another user trip', async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${anotherToken}`);
    expect(res.status).toBe(404); // Should not expose the trip exists
  });

  it('should NOT allow user to delete another user trip', async () => {
    const res = await request(app)
      .delete(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${anotherToken}`);
    expect(res.status).toBe(404);
  });

  it('should NOT allow user to update another user trip', async () => {
    const res = await request(app)
      .put(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({ destination: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('should allow owner to access their own trip', async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.destination).toBe('Tokyo');
  });

  it('should require authentication for trip access', async () => {
    const res = await request(app).get(`/api/trips/${tripId}`);
    expect(res.status).toBe(401);
  });
});
