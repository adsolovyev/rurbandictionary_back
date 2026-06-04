import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';

export const register = async (req: Request, res: Response) => {
  const { login, email, password } = req.body;

  if (!login || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Проверяем, не заняты ли login или email
    const existing = await pool.query(
      'SELECT id FROM ud_users WHERE login = $1 OR email = $2',
      [login, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Login or email already exists' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Вставляем пользователя
    const result = await pool.query(
      `INSERT INTO ud_users (login, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, login, email, created_at`,
      [login, email, hashedPassword]
    );

    const newUser = result.rows[0];
    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
};

export const login = async (req: Request, res: Response) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  try {
    const result = await pool.query(
      'SELECT id, login, email, password_hash, is_admin FROM ud_users WHERE login = $1 OR email = $1',
      [login]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
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
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Logged in successfully', user: { id: user.id, login: user.login, email: user.email, isAdmin: user.is_admin } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};