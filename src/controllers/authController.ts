import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { sendTelegramNotification } from '../services/telegram';

export const register = async (req: Request, res: Response) => {
  const { login, email, password } = req.body;

  if (!login || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('=== REGISTER ATTEMPT ===', { login, email });

    // Проверяем, не заняты ли login или email
    const existing = await pool.query(
      'SELECT id FROM ud_users WHERE login = $1 OR email = $2',
      [login, email]
    );
    if (existing.rows.length > 0) {
      console.log('User already exists');
      return res.status(409).json({ error: 'Login or email already exists' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed');

    // Вставляем пользователя, явно указываем все колонки
    const result = await pool.query(
      `INSERT INTO ud_users (login, email, password_hash, status, is_admin, created_at)
       VALUES ($1, $2, $3, 'active', false, NOW())
       RETURNING id, login, email, created_at`,
      [login, email, hashedPassword]
    );

    const newUser = result.rows[0];
    console.log('User created:', newUser);
    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('REGISTRATION ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  try {
    console.log('=== LOGIN ATTEMPT ===', { login });

    const result = await pool.query(
      'SELECT id, login, email, password_hash, is_admin FROM ud_users WHERE login = $1 OR email = $1',
      [login]
    );
    if (result.rows.length === 0) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, login: user.login, isAdmin: user.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// // new 
// res.cookie('token', token, {
//   httpOnly: true,
//   secure: true,                     // всегда true для HTTPS
//   sameSite: 'lax',                  // важно: не 'none' для одного домена
//   maxAge: 7 * 24 * 60 * 60 * 1000,
//   path: '/',
//   // domain не указываем — кука будет привязана к текущему домену (прокси)
// });


    console.log('Login successful for', user.login);
    res.json({ message: 'Logged in successfully', user: { id: user.id, login: user.login, email: user.email, isAdmin: user.is_admin } });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const result = await pool.query(
      'SELECT id, login, email, is_admin FROM ud_users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    res.json({ user: { id: user.id, login: user.login, email: user.email, isAdmin: user.is_admin } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { login, email, password, notes } = req.body;

  if (!login || !email || !password) {
    return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
  }
  if (login.length > 50) {
    return res.status(400).json({ error: 'Имя пользователя не может быть длиннее 50 символов' });
  }
  if (email.length > 100) {
    return res.status(400).json({ error: 'Email не может быть длиннее 100 символов' });
  }
  if (notes && notes.length > 500) {
    return res.status(400).json({ error: 'Поле "последние взаимодействия" не может быть длиннее 500 символов' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO ur_reset_pwd (user_id, user_mail, new_password_hash, notes, status, created_at)
       VALUES ($1, $2, $3, $4, 'Active', NOW())
       RETURNING id`,
      [login, email, hashedPassword, notes || null]
    );
    const requestId = result.rows[0].id;

    console.log(`Заявка на смену пароля создана: id=${requestId}, пользователь=${login}`);

    // Отправка уведомления в Telegram
    const message = `
<b>[ЗАПРОС СМЕНЫ ПАРОЛЯ]</b>
Пользователь: ${login}
Email: ${email}
Доп. информация: ${notes || 'не указана'}
Ссылка: https://rude-lv1t.onrender.com/admin/reset-requests
    `;
    sendTelegramNotification(message);

    res.status(201).json({ message: 'Заявка на смену пароля успешно создана' });
  } catch (err) {
    console.error('Ошибка при создании заявки на смену пароля:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};