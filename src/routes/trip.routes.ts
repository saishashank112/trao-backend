import { Router } from 'express';
import {
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  addActivity,
  deleteActivity,
  updateActivity,
  shareTrip,
  unshareTrip,
  getSharedTrip,
  getTripStats,
  enrichTrip,
} from '../controllers/trip.controller';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTripSchema, updateTripSchema, addActivitySchema, updateActivitySchema } from '../validators/trip.validator';

const router = Router();

// Public route for shared trips
router.get('/shared/:token', getSharedTrip);

// All other trip routes require authentication
router.use(protect);

router.get('/stats', getTripStats);
router.get('/', getTrips);
router.post('/', validate(createTripSchema), createTrip);
router.get('/:id', getTrip);
router.put('/:id', validate(updateTripSchema), updateTrip);
router.delete('/:id', deleteTrip);
router.post('/:id/enrich', enrichTrip);

// Activity routes
router.post('/:id/activity', validate(addActivitySchema), addActivity);
router.put('/:id/activity/:activityId', validate(updateActivitySchema), updateActivity);
router.delete('/:id/activity/:activityId', deleteActivity);

// Sharing routes
router.post('/:id/share', shareTrip);
router.delete('/:id/share', unshareTrip);

export default router;
