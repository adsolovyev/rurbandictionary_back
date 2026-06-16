import { Router } from 'express';
import { register, login, getMe, logout, requestPasswordReset } from '../controllers/authController';
import { authenticate } from '../middleware/auth';


const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.post('/request-password-reset', requestPasswordReset);

export default router;