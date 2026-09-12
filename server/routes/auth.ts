import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { requireAuth, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

export const authRouter = Router();

// Login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    const cleanLogin = login.trim().toLowerCase();

    const result = await query(
      `SELECT id, email, username, password_hash, full_name, theme_preference, created_at
       FROM users
       WHERE email = $1 OR username = $1`,
      [cleanLogin]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials. User not found.' });
      return;
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials. Password does not match.' });
      return;
    }

    const token = signToken({ id: user.id, email: user.email, username: user.username });
    setAuthCookie(res, token);

    const { password_hash, ...userProfile } = user;

    res.json({
      user: userProfile,
      token,
      message: 'Logged in successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// Logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully.' });
});

// Current User Session
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT id, email, username, full_name, theme_preference, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      clearAuthCookie(res);
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Update Profile & Preferences
authRouter.put('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { fullName, themePreference } = req.body;

    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           theme_preference = COALESCE($2, theme_preference),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, username, full_name, theme_preference, updated_at`,
      [fullName, themePreference, userId]
    );

    res.json({
      user: result.rows[0],
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});
