import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import definitionRoutes from './routes/definitionRoutes';
import browseRoutes from './routes/browseRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import session from 'express-session';
import passport from 'passport';
import configurePassport from './config/passport';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 5000;

app.use(cors({
  origin: 'https://rude-lv1t.onrender.com',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// Goo Auth
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, 
    maxAge: 24 * 60 * 60 * 1000 
  }
}));
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

app.use('/api/auth', authRoutes);
app.use('/api/definitions', definitionRoutes);
app.use('/api', browseRoutes); // /api/browse, /api/suggest, /api/random-word
app.use('/api/admin', adminRoutes);

app.use('/api/user', userRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`Error handling request: ${req.method} ${req.url}`);
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});