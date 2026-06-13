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
      const result = await pool.query('SELECT id, login, email, is_admin FROM ud_users WHERE email = $1', [email]);
      let user = result.rows[0];
      if (!user) {
        let login = profile.displayName || email.split('@')[0];
        const loginCheck = await pool.query('SELECT id FROM ud_users WHERE login = $1', [login]);
        if (loginCheck.rows.length > 0) {
          login += Math.floor(Math.random() * 10000);
        }
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const newUser = await pool.query(
          `INSERT INTO ud_users (login, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, login, email, is_admin`,
          [login, email, hashedPassword, false]
        );
        user = newUser.rows[0];
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
      const result = await pool.query('SELECT id, login, email, is_admin FROM ud_users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (err) {
      done(err, null);
    }
  });
}