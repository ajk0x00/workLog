import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

// Get all companies for current user
companiesRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT c.id, c.name, c.color, c.is_current, c.created_at,
              COUNT(wl.id)::int AS log_count
       FROM companies c
       LEFT JOIN work_logs wl ON c.id = wl.company_id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.is_current DESC, c.name ASC`,
      [userId]
    );

    res.json({ companies: result.rows });
  } catch (err) {
    next(err);
  }
});

// Create a new company
companiesRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, color, isCurrent } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }

    const cleanName = name.trim();
    const cleanColor = color || '#3b82f6';
    const cleanIsCurrent = Boolean(isCurrent);

    if (cleanIsCurrent) {
      await query('UPDATE companies SET is_current = false WHERE user_id = $1', [userId]);
    }

    const result = await query(
      `INSERT INTO companies (user_id, name, color, is_current)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, is_current, created_at`,
      [userId, cleanName, cleanColor, cleanIsCurrent]
    );

    res.status(201).json({ company: result.rows[0], message: 'Company created.' });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'A company with this name already exists.' });
      return;
    }
    next(err);
  }
});

// Update company
companiesRouter.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const companyId = parseInt(String(req.params.id), 10);
    const { name, color, isCurrent } = req.body;

    if (isCurrent) {
      await query('UPDATE companies SET is_current = false WHERE user_id = $1 AND id != $2', [
        userId,
        companyId,
      ]);
    }

    const result = await query(
      `UPDATE companies
       SET name = COALESCE($1, name),
           color = COALESCE($2, color),
           is_current = COALESCE($3, is_current)
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, color, is_current, created_at`,
      [name?.trim(), color, isCurrent !== undefined ? Boolean(isCurrent) : undefined, companyId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    res.json({ company: result.rows[0], message: 'Company updated.' });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'A company with this name already exists.' });
      return;
    }
    next(err);
  }
});

// Delete company
companiesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const companyId = parseInt(String(req.params.id), 10);

    const result = await query('DELETE FROM companies WHERE id = $1 AND user_id = $2 RETURNING id', [
      companyId,
      userId,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    res.json({ message: 'Company removed.' });
  } catch (err) {
    next(err);
  }
});
