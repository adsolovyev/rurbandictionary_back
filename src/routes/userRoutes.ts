import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSettings, upsertSetting } from '../controllers/userController';

const router = Router();
router.get('/settings', authenticate, getSettings);
router.post('/settings', authenticate, upsertSetting);
export default router;