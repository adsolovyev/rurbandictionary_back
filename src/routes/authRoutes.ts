import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  const user = req.user as any;
  if (!user) return res.redirect('/login');
  const token = jwt.sign(
    { id: user.id, login: user.login, isAdmin: user.is_admin },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
  const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(redirectUrl);
});

export default router;