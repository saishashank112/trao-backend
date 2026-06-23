import { Router } from 'express';
import { getProfile, updateProfile, updatePassword, deleteAccount } from '../controllers/profile.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', updatePassword);
router.delete('/', deleteAccount);

export default router;
