import { Request, Response } from 'express';
import pool from '../db';

// GET /api/browse?letter=К&page=1&limit=20
export const getWordsByLetter = async (req: Request, res: Response) => {
  const letter = req.query.letter as string | undefined;
  if (!letter) {
    return res.status(400).json({ error: 'Missing letter parameter' });
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = (page - 1) * limit;

  try {
    let queryWords: string;
    let queryCount: string;
    const paramsWords: (string | number)[] = [];
    const paramsCount: (string | number)[] = [];

    if (letter === '#') {
      // non-cyrillic
      queryCount = `
        SELECT COUNT(DISTINCT word) as total
        FROM ud_definitions
        WHERE word !~ '^[А-Яа-яЁё]' AND status = 'active'
      `;
      queryWords = `
        SELECT DISTINCT word
        FROM ud_definitions
        WHERE word !~ '^[А-Яа-яЁё]' AND status = 'active'
        ORDER BY word
        LIMIT $1 OFFSET $2
      `;
      paramsWords.push(limit, offset);
    } else {
      queryCount = `
        SELECT COUNT(DISTINCT word) as total
        FROM ud_definitions
        WHERE word ILIKE $1 AND status = 'active'
      `;
      paramsCount.push(`${letter}%`);
      queryWords = `
        SELECT DISTINCT word
        FROM ud_definitions
        WHERE word ILIKE $1 AND status = 'active'
        ORDER BY word
        LIMIT $2 OFFSET $3
      `;
      paramsWords.push(`${letter}%`, limit, offset);
    }

    const countResult = await pool.query(queryCount, paramsCount);
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(queryWords, paramsWords);
    const words = result.rows.map(row => row.word);

    res.json({ words, page, limit, total, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch words by letter' });
  }
};

// GET /api/suggest?q=...
export const getSuggestions = async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  if (!q || q.length < 1) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT word
       FROM ud_definitions
       WHERE word ILIKE $1 AND status = 'active'
       ORDER BY word
       LIMIT 10`,
      [`${q}%`]
    );
    res.json(result.rows.map(row => row.word));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

// GET /api/random-word
export const getRandomWord = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT word
       FROM ud_definitions
       WHERE status = 'active'
       GROUP BY word
       ORDER BY RANDOM()
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No words found' });
    }
    res.json({ word: result.rows[0].word });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch random word' });
  }
};

// GET /api/words/active
export const getActiveWords = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT word FROM ud_definitions WHERE status = 'active' ORDER BY word`
    );
    const words = result.rows.map(row => row.word);
    res.json(words);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active words' });
  }
};