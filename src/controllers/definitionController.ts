import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../db';

// GET /api/definitions/random?limit=10
export const getRandomDefinitions = async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const userId = req.user?.id || null;
  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       ORDER BY RANDOM()
       LIMIT $2`,
      [userId, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch random definitions' });
  }
};

// GET /api/definitions?word=...&page=...&limit=...
export const getDefinitionsByWord = async (req: AuthRequest, res: Response) => {
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
       WHERE d.word ILIKE $2
       ORDER BY (d.upvotes - d.downvotes) DESC, d.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, word, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch definitions by word' });
  }
};

// POST /api/definitions
export const createDefinition = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { word, definition, example } = req.body;
  if (!word || !definition) {
    return res.status(400).json({ error: 'Word and definition are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ud_definitions (word, definition, example, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, word, definition, example, created_at, upvotes, downvotes`,
      [word.trim(), definition.trim(), example?.trim() || null, req.user.id]
    );
    const newDef = result.rows[0];
    newDef.author = req.user.login;
    res.status(201).json(newDef);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create definition' });
  }
};

// POST /api/definitions/:id/vote
export const voteDefinition = async (req: AuthRequest, res: Response) => {
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
    res.json({ upvotes: updated.rows[0].upvotes, downvotes: updated.rows[0].downvotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process vote' });
  }
};

// POST /api/definitions/:id/report
export const reportDefinition = async (req: AuthRequest, res: Response) => {
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
    await pool.query(
      `INSERT INTO ud_reports (definition_id, reporter_id, reason, comment)
       VALUES ($1, $2, $3, $4)`,
      [definitionId, req.user.id, reason, comment || null]
    );
    res.status(201).json({ message: 'Report submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

export const getDefinitionById = async (req: AuthRequest, res: Response) => {
  const idParam = req.params.id;
  if (typeof idParam !== 'string') {
    return res.status(400).json({ error: 'Invalid definition id' });
  }
  const definitionId = parseInt(idParam, 10);
  if (isNaN(definitionId)) {
    return res.status(400).json({ error: 'Definition id must be a number' });
  }
  const userId = req.user?.id || null;
  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author,
        (SELECT vote_type FROM ud_votes WHERE user_id = $1 AND definition_id = d.id) as user_vote
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.id = $2`,
      [userId, definitionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Definition not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch definition' });
  }
};

export const getDefinitionsByAuthor = async (req: AuthRequest, res: Response) => {
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
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch definitions by author' });
  }
};

