import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../db';
import { sendTelegramNotification } from '../services/telegram';

// GET /api/definitions/random?limit=10
export const getRandomDefinitions = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions/random');
  const limit = parseInt(req.query.limit as string || '10', 10);
  const userId = req.user?.id || null;
  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
      FROM ud_definitions d
      LEFT JOIN ud_users u ON d.author_id = u.id
      WHERE d.status = 'active'
      ORDER BY RANDOM()
      LIMIT $2`,
      [userId, limit]
    );
    console.log('Query executed successfully for /api/definitions/random');
    res.json(result.rows);
  } catch (err: unknown) {
    console.error('Error executing query for random definitions:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch random definitions' });
  }
};

// GET /api/definitions?word=...&page=...&limit=...
export const getDefinitionsByWord = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions?word=...');
  const word = req.query.word as string;
  if (!word) {
    return res.status(400).json({ error: 'Missing word parameter' });
  }
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;
  const userId = req.user?.id || null;

  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.status = 'active' AND d.word ILIKE $2
       ORDER BY (d.upvotes - d.downvotes) DESC, d.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, `%${word}%`, limit, offset]
    );
    console.log('Query executed successfully for /api/definitions?word=...');
    res.json(result.rows);
  } catch (err: unknown) {
    console.error('Error executing query for definitions by word:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch definitions by word' });
  }
};

// POST /api/definitions
export const createDefinition = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions POST');
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { word, definition, example } = req.body;
  if (!word || !definition) {
    return res.status(400).json({ error: 'Word and definition are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ud_definitions (word, definition, example, author_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id, word, definition, example, created_at, upvotes, downvotes`,
      [word.trim(), definition.trim(), example?.trim() || null, req.user.id]
    );
    const newDef = result.rows[0];
    newDef.author = req.user.login;
    console.log('Definition created successfully:', newDef);

    // Отправка уведомления в Telegram
    const message = `
<b>[НОВОЕ СЛОВО НА МОДЕРАЦИЮ]</b>
Слово: ${newDef.word}
Автор: ${req.user.login}
Определение: ${(newDef.definition || '').slice(0, 200)}${(newDef.definition || '').length > 200 ? '...' : ''}
Ссылка: https://rude-lv1t.onrender.com/admin/pending
    `;
    sendTelegramNotification(message);

    res.status(201).json(newDef);
  } catch (err: unknown) {
    console.error('Error creating definition:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create definition' });
  }
};

// POST /api/definitions/:id/vote
export const voteDefinition = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions/:id/vote');
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idParam = req.params.id;
  if (Array.isArray(idParam) || typeof idParam !== 'string') {
    return res.status(400).json({ error: 'Invalid definition id' });
  }
  const definitionId = parseInt(idParam, 10);
  if (isNaN(definitionId)) {
    return res.status(400). json({ error: 'Definition id must be a number' });
  }

  const { vote } = req.body;
  if (vote !== 'up' && vote !== 'down') {
    return res.status(400).json({ error: 'Vote must be "up" or "down"' });
  }
  const voteValue = vote === 'up' ? 1 : -1;

  try {
    const existing = await pool.query(
      'SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = $2',
      [req.user.id, definitionId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO ud_votes (user_id, definition_id, vote_type) VALUES ($1, $2, $3)',
        [req.user.id, definitionId, voteValue]
      );
      if (vote === 'up') {
        await pool.query('UPDATE ud_definitions SET upvotes = upvotes + 1 WHERE id = $1', [definitionId]);
      } else {
        await pool.query('UPDATE ud_definitions SET downvotes = downvotes + 1 WHERE id = $1', [definitionId]);
      }
    } else {
      const currentVote = existing.rows[0].vote_type;
      if (currentVote === voteValue) {
        await pool.query('DELETE FROM ud_votes WHERE user_id = $1 AND definition_id = $2', [req.user.id, definitionId]);
        if (vote === 'up') {
          await pool.query('UPDATE ud_definitions SET upvotes = upvotes - 1 WHERE id = $1', [definitionId]);
        } else {
          await pool.query('UPDATE ud_definitions SET downvotes = downvotes - 1 WHERE id = $1', [definitionId]);
        }
      } else {
        await pool.query('UPDATE ud_votes SET vote_type = $1 WHERE user_id = $2 AND definition_id = $3', [voteValue, req.user.id, definitionId]);
        if (vote === 'up') {
          await pool.query('UPDATE ud_definitions SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = $1', [definitionId]);
        } else {
          await pool.query('UPDATE ud_definitions SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = $1', [definitionId]);
        }
      }
    }

    const updated = await pool.query('SELECT upvotes, downvotes FROM ud_definitions WHERE id = $1', [definitionId]);
    console.log('Vote processed successfully:', updated.rows[0]);
    res.json({ upvotes: updated.rows[0].upvotes, downvotes: updated.rows[0].downvotes });
  } catch (err: unknown) {
    console.error('Error processing vote:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to process vote' });
  }
};

// POST /api/definitions/:id/report
export const reportDefinition = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions/:id/report');
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idParam = req.params.id;
  if (Array.isArray(idParam) || typeof idParam !== 'string') {
    return res.status(400).json({ error: 'Invalid definition id' });
  }
  const definitionId = parseInt(idParam, 10);
  if (isNaN(definitionId)) {
    return res.status(400).json({ error: 'Definition id must be a number' });
  }

  const { reason, comment } = req.body;
  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  try {
    // Вставляем жалобу и получаем её id
    const result = await pool.query(
      `INSERT INTO ud_reports (definition_id, reporter_id, reason, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [definitionId, req.user.id, reason, comment || null]
    );
    const reportId = result.rows[0].id;

    // Получаем информацию об определении и авторе для сообщения
    const defInfo = await pool.query(
      `SELECT d.word, u.login as author_login
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.id = $1`,
      [definitionId]
    );
    const word = defInfo.rows[0]?.word || 'неизвестно';
    const authorLogin = defInfo.rows[0]?.author_login || 'неизвестен';

    console.log('Report submitted successfully');

    // Отправка уведомления в Telegram
    const message = `
<b>[НОВАЯ ЖАЛОБА]</b>
Слово: ${word}
Причина: ${reason}
Автор определения: ${authorLogin}
Жалобу подал: ${req.user.login}
Ссылка: https://rude-lv1t.onrender.com/admin/reports
    `;
    sendTelegramNotification(message);

    res.status(201).json({ message: 'Report submitted' });
  } catch (err: unknown) {
    console.error('Error submitting report:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

// GET /api/definitions/:id
export const getDefinitionById = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions/:id');
  const idParam = req.params.id;
  if (typeof idParam !== 'string') {
    return res.status(400).json({ error: 'Invalid definition id' });
  }
  const definitionId = parseInt(idParam, 10);
  if (isNaN(definitionId)) {
    return res.status(400).json({ error: 'Definition id must be a number' });
  }
  const userId = req.user?.id || null;

  console.log('Fetching definition id:', definitionId);
  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.id = $2 AND d.status = 'active'`,
      [userId, definitionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Definition not found' });
    }
    console.log('Fetched definition by id successfully:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err: unknown) {
    console.error('Error fetching definition by id:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch definition' });
  }
};

// GET /api/definitions/by-author
export const getDefinitionsByAuthor = async (req: AuthRequest, res: Response) => {
  console.log('Handling /api/definitions/by-author');
  const author = req.query.author as string;
  if (!author) {
    return res.status(400).json({ error: 'Missing author parameter' });
  }
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = (page - 1) * limit;
  const userId = req.user?.id || null;

  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE u.login = $2
       ORDER BY (d.upvotes - d.downvotes) DESC, d.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, author, limit, offset]
    );
    console.log('Fetched definitions by author successfully:', result.rows);
    res.json(result.rows);
  } catch (err: unknown) {
    console.error('Error fetching definitions by author:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch definitions by author' });
  }
};

// GET /api/definitions/word/:word/exact?limit=5
export const getDefinitionsByExactWord = async (req: AuthRequest, res: Response) => {
  const word = req.params.word;
  const limit = parseInt(req.query.limit as string, 10) || 5;
  const userId = req.user?.id || null;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is missing' });
  }

  try {
    const result = await pool.query(
      `SELECT d.id, d.word, d.definition, d.example, d.created_at, d.upvotes, d.downvotes, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.status = 'active' AND d.word ILIKE $2
       ORDER BY (d.upvotes - d.downvotes) DESC, d.created_at DESC
       LIMIT $3`,
      [userId, word, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch definitions by exact word' });
  }
};

// GET /api/definitions/latest?page=1&limit=20
export const getLatestDefinitions = async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = (page - 1) * limit;
  const userId = req.user?.id || null;

  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.status = 'active' OR d.status IS NULL
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch latest definitions' });
  }
};

// GET /api/definitions/suggestions
export const getSuggestionsData = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (word) word, definition
       FROM ud_definitions
       WHERE status = 'active'
       ORDER BY word, (upvotes - downvotes) DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch suggestions data' });
  }
};