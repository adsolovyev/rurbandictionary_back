import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../db';
import bcrypt from 'bcrypt';

export default function configurePassport() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('Нет email от Google'), undefined);
      
      // Ищем пользователя по email
      const result = await pool.query('SELECT id, login, email, is_admin, status, created_at FROM ud_users WHERE email = $1', [email]);
      let user = result.rows[0];
      
      if (!user) {
        // Создаём нового пользователя
        let login = profile.displayName || email.split('@')[0];
        const loginCheck = await pool.query('SELECT id FROM ud_users WHERE login = $1', [login]);
        if (loginCheck.rows.length > 0) {
          login += Math.floor(Math.random() * 10000);
        }
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        const newUser = await pool.query(
          `INSERT INTO ud_users (login, email, password_hash, is_admin, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, login, email, is_admin, status, created_at`,
          [login, email, hashedPassword, false, 'active', new Date()]
        );
        user = newUser.rows[0];
      } else {
        // Если пользователь существует, обновляем status и created_at, если они NULL
        let needUpdate = false;
        if (user.status === null) {
          user.status = 'active';
          needUpdate = true;
        }
        if (user.created_at === null) {
          user.created_at = new Date();
          needUpdate = true;
        }
        if (needUpdate) {
          await pool.query('UPDATE ud_users SET status = $1, created_at = $2 WHERE id = $3', [user.status, user.created_at, user.id]);
        }
      }
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const result = await pool.query('SELECT id, login, email, is_admin, status, created_at FROM ud_users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (err) {
      done(err, null);
    }
  });
}