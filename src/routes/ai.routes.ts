import { Router } from 'express';
import {
  generateTrip,
  regenerateDay,
  compareDestinations,
  getTripWeather,
  getMoodPreview,
  getConciergeHistory,
  handleConcierge,
} from '../controllers/ai.controller';
import { protect } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(protect);
router.use(aiLimiter);

router.post('/generate-trip', generateTrip);
router.post('/regenerate-day', regenerateDay);
router.post('/compare', compareDestinations);
router.get('/weather/:tripId', getTripWeather);
router.post('/mood-preview', getMoodPreview);
router.get('/concierge/history', getConciergeHistory);
router.post('/concierge', handleConcierge);

export default router;
