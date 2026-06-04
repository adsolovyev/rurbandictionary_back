import { Request, Response } from 'express';
import pool from '../db';

// GET /api/browse?letter=К
export const getWordsByLetter = async (req: Request, res: Response) => {
  const letter = req.query.letter as string | undefined;
  if (!letter) {
    return res.status(400).json({ error: 'Missing letter parameter' });
  }

  try {
    let query: string;
    const params: (string | number)[] = [];

    if (letter === '#') {
      // non-cyrillic: символы, не входящие в диапазон русских букв
      query = `
        SELECT DISTINCT word
        FROM ud_definitions
        WHERE word !~ '^[А-Яа-яЁё]'
        ORDER BY word
        LIMIT 100
      `;
    } else {
      query = `
        SELECT DISTINCT word
        FROM ud_definitions
        WHERE word ILIKE $1
        ORDER BY word
        LIMIT 100
      `;
      params.push(`${letter}%`);
    }

    const result = await pool.query(query, params);
    res.json(result.rows.map(row => row.word));
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
       WHERE word ILIKE $1
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