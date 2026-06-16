import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../db';
import bcrypt from 'bcrypt';
import { sendEmail } from '../services/email';

export const getPendingDefinitions = async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT d.*, u.login as author
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.status = 'pending'
       ORDER BY d.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending definitions' });
  }
};

export const approveDefinition = async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await pool.query(
      `UPDATE ud_definitions SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Definition not found or already processed' });
    }

    // Получаем данные автора для письма
    const defInfo = await pool.query(
      `SELECT d.word, u.email, u.login
       FROM ud_definitions d
       JOIN ud_users u ON d.author_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    if (defInfo.rows.length > 0) {
      const { word, email, login } = defInfo.rows[0];
      const subject = `Ваше определение "${word}" одобрено!`;
      const html = `
        <p>Привет, ${login}!</p>
        <p>Ваше определение для слова <strong>"${word}"</strong> прошло модерацию и опубликовано в словаре.</p>
        <p>Спасибо за вклад в Russian Urban Dictionary!</p>
        <p><a href="https://rurde-proxy.onrender.com">Перейти на сайт</a></p>
      `;
      // Отправляем без await, чтобы не задерживать ответ
      sendEmail(email, subject, html);
    }

    res.json({ message: 'Definition approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve definition' });
  }
};

export const rejectDefinition = async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { reason } = req.body; // строка причины
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query(
      `UPDATE ud_definitions SET status = 'rejected', rejection_reason = $1 WHERE id = $2 AND status = 'pending' RETURNING id`,
      [reason || null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Definition not found or already processed' });
    }
    res.json({ message: 'Definition rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject definition' });
  }
};

// GET /api/admin/reports
export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
              d.word, d.definition, d.example, d.created_at as def_created_at, d.upvotes, d.downvotes,
              u.login as author, 
              rep.login as reporter_login
       FROM ud_reports r
       JOIN ud_definitions d ON r.definition_id = d.id
       LEFT JOIN ud_users u ON d.author_id = u.id
       LEFT JOIN ud_users rep ON r.reporter_id = rep.id
       WHERE r.resolved = false
       ORDER BY r.created_at DESC`
    );
    const reports = result.rows.map((row: any) => ({
      id: row.id,
      definition_id: row.definition_id,
      reason: row.reason,
      comment: row.comment,
      created_at: row.created_at,
      resolved: row.resolved,
      definition: {
        id: row.definition_id,
        word: row.word,
        definition: row.definition,
        example: row.example,
        author: row.author,
        created_at: row.def_created_at,
        upvotes: row.upvotes,
        downvotes: row.downvotes,
      },
      reporter: {
        id: row.reporter_id,
        login: row.reporter_login,
      }
    }));
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const pendingDefs = await pool.query('SELECT COUNT(*) FROM ud_definitions WHERE status = $1', ['pending']);
    const pendingReports = await pool.query('SELECT COUNT(*) FROM ud_reports WHERE resolved = $1', [false]);
    const pendingResets = await pool.query('SELECT COUNT(*) FROM ur_reset_pwd WHERE status = $1', ['Active']);
    res.json({
      pendingDefinitions: parseInt(pendingDefs.rows[0].count, 10),
      pendingReports: parseInt(pendingReports.rows[0].count, 10),
      pendingResets: parseInt(pendingResets.rows[0].count, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
};

export const getRecentPendingDefinitions = async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 10;
  try {
    const result = await pool.query(
      `SELECT d.id, d.word, d.created_at, u.login as author
       FROM ud_definitions d
       LEFT JOIN ud_users u ON d.author_id = u.id
       WHERE d.status = 'pending'
       ORDER BY d.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent pending definitions' });
  }
};

export const getAllActiveReports = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.definition_id, r.reporter_id, r.reason, r.comment, r.created_at, r.resolved,
              d.word, d.definition, d.example, d.created_at as def_created_at, d.upvotes, d.downvotes,
              u.id as author_id, u.login as author_login,
              (SELECT COUNT(*) FROM ud_definitions WHERE author_id = u.id AND status = 'active') as author_definitions_count,
              (SELECT COUNT(*) FROM ud_reports WHERE definition_id IN (SELECT id FROM ud_definitions WHERE author_id = u.id) AND resolved = false) as author_reports_count
       FROM ud_reports r
       JOIN ud_definitions d ON r.definition_id = d.id
       JOIN ud_users u ON d.author_id = u.id
       WHERE r.resolved = false
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Разрешить жалобу (закрыть) с комментарием администратора
export const resolveReport = async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { adminComment } = req.body;
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query('UPDATE ud_reports SET resolved = true, admin_comment = $1 WHERE id = $2', [adminComment || null, id]);
    res.json({ message: 'Report resolved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};

// Блокировка слова (меняем статус определения на 'blocked')
export const blockDefinition = async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid definition id' });
  try {
    // Блокируем определение
    await pool.query('UPDATE ud_definitions SET status = $1 WHERE id = $2', ['blocked', id]);
    
    // Автоматически закрываем все неразрешённые жалобы на это определение
    await pool.query('UPDATE ud_reports SET resolved = true WHERE definition_id = $1 AND resolved = false', [id]);
    
    res.json({ message: 'Definition blocked and related reports resolved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to block definition' });
  }
};

// Блокировка автора (устанавливаем status = 'banned' в ud_users)
export const banUser = async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId as string, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
  try {
    await pool.query('UPDATE ud_users SET status = $1 WHERE id = $2', ['banned', userId]);
    // Также блокируем все активные определения пользователя (меняем статус на 'blocked')
    await pool.query('UPDATE ud_definitions SET status = $1 WHERE author_id = $2 AND status = $3', ['blocked', userId, 'active']);
    res.json({ message: 'User banned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

// (Опционально) Получить недавние жалобы для дашборда (10 шт)
export const getRecentReports = async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 10;
  try {
    const result = await pool.query(
      `SELECT r.id, d.word as definition_word, r.reason, r.created_at
       FROM ud_reports r
       JOIN ud_definitions d ON r.definition_id = d.id
       WHERE r.resolved = false
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent reports' });
  }
};

// GET /api/admin/users – список всех пользователей (только для админа)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const search = req.query.search as string | undefined;
  try {
    let query = 'SELECT id, login, email FROM ud_users';
    const params: string[] = [];
    if (search) {
      query += ' WHERE login ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// POST /api/admin/users/:userId/reset-password – сброс пароля админом
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const userId = parseInt(req.params.userId as string, 10);
  const { newPassword } = req.body;
  if (isNaN(userId) || !newPassword) {
  return res.status(400).json({ error: 'Invalid user ID or missing password' });
  }
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE ud_users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const query = req.query.q as string | undefined;
  if (!query || query.length < 2) {
    return res.json([]);
  }
  try {
    const result = await pool.query(
      `SELECT id, login, email FROM ud_users
       WHERE login ILIKE $1 OR email ILIKE $1
       ORDER BY login
       LIMIT 20`,
      [`%${query}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

// Получить все активные заявки на смену пароля
export const getActiveResetRequests = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, r.user_mail, r.new_password_hash, r.notes, r.status, r.created_at
       FROM ur_reset_pwd r
       WHERE r.status = 'Active'
       ORDER BY r.created_at DESC`
    );
    // Для каждой заявки проверим, есть ли такой пользователь в ud_users
    const requests = await Promise.all(result.rows.map(async (row) => {
      // Проверим login
      const loginCheck = await pool.query('SELECT id FROM ud_users WHERE login = $1', [row.user_id]);
      const emailCheck = await pool.query('SELECT id FROM ud_users WHERE email = $1', [row.user_mail]);
      let userId = null;
      let userMatch = false;
      if (loginCheck.rows.length > 0 && emailCheck.rows.length > 0) {
        // Если оба найдены, проверим, принадлежат ли одной записи
        const bothCheck = await pool.query('SELECT id FROM ud_users WHERE login = $1 AND email = $2', [row.user_id, row.user_mail]);
        if (bothCheck.rows.length > 0) {
          userId = bothCheck.rows[0].id;
          userMatch = true;
        }
      }
      return {
        ...row,
        loginExists: loginCheck.rows.length > 0,
        emailExists: emailCheck.rows.length > 0,
        userMatch,
        matchedUserId: userId,
      };
    }));
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reset requests' });
  }
};

// Применить новый пароль (смена пароля для пользователя, заявка -> Solved)
export const applyResetPassword = async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(String(req.params.id), 10)
  if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request id' });

  try {
    // Получаем заявку
    const requestResult = await pool.query(
      'SELECT user_id, user_mail, new_password_hash FROM ur_reset_pwd WHERE id = $1 AND status = $2',
      [requestId, 'Active']
    );
    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    const { user_id, user_mail, new_password_hash } = requestResult.rows[0];

    // Найдём пользователя, у которого login = user_id и email = user_mail (одновременно)
    const userCheck = await pool.query(
      'SELECT id FROM ud_users WHERE login = $1 AND email = $2',
      [user_id, user_mail]
    );
    if (userCheck.rowCount === 0) {
      return res.status(400).json({ error: 'User not found or credentials mismatch' });
    }
    const userId = userCheck.rows[0].id;

    // Обновляем пароль
    await pool.query('UPDATE ud_users SET password_hash = $1 WHERE id = $2', [new_password_hash, userId]);
    // Меняем статус заявки
    await pool.query('UPDATE ur_reset_pwd SET status = $1 WHERE id = $2', ['Solved', requestId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to apply reset' });
  }
};

// Отклонить заявку
export const rejectResetRequest = async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(String(req.params.id), 10)
  if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request id' });

  try {
    const result = await pool.query(
      'UPDATE ur_reset_pwd SET status = $1 WHERE id = $2 AND status = $3',
      ['Rejected', requestId, 'Active']
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject request' });
  }
};