import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import definitionRoutes from './routes/definitionRoutes';
import browseRoutes from './routes/browseRoutes';
import userRoutes from './routes/userRoutes';

console.log('=== SERVER FILE RELOADED ===');
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Логирование запросов
app.use((req, res, next) => {
  console.log(`Handling request: ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/definitions', definitionRoutes);
app.use('/api', browseRoutes); // /api/browse, /api/suggest, /api/random-word

// Простой эндпоинт для проверки
app.get('/', (req, res) => {
  res.send('Backend is working');
});

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