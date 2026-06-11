import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../db';

// GET /api/user/settings
export const getSettings = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      'SELECT key, value FROM ud_user_settings WHERE user_id = $1',
      [req.user.id]
    );
    const settings = result.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// POST /api/user/settings (body: { key: string, value: string })
export const upsertSetting = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    await pool.query(
      `INSERT INTO ud_user_settings (user_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [req.user.id, key, value]
    );
    res.json({ message: 'Setting saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
};