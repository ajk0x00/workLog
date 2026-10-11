import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

// Normalize MM/YYYY or YYYY-MM input to MM/YYYY; returns null for invalid/empty
function normalizeMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) return `${ymMatch[2]}/${ymMatch[1]}`;
  return /^\d{2}\/\d{4}$/.test(trimmed) ? trimmed : null;
}

const pick = (body: any, ...keys: string[]) => {
  for (const key of keys) {
    if (body[key] !== undefined) return body[key];
  }
  return undefined;
};

// Get all companies for current user
companiesRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT c.id, c.name, c.color, c.is_current, c.job_title, c.location, c.start_month, c.end_month, c.created_at,
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
    const jobTitle = pick(req.body, 'jobTitle', 'job_title');
    const location = req.body.location;
    const startMonth = normalizeMonth(pick(req.body, 'startMonth', 'start_month'));
    const endMonth = normalizeMonth(pick(req.body, 'endMonth', 'end_month'));

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
      `INSERT INTO companies (user_id, name, color, is_current, job_title, location, start_month, end_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, color, is_current, job_title, location, start_month, end_month, created_at`,
      [
        userId,
        cleanName,
        cleanColor,
        cleanIsCurrent,
        typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim() : null,
        typeof location === 'string' && location.trim() ? location.trim() : null,
        startMonth,
        endMonth,
      ]
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
    const body = req.body || {};

    const isCurrent = pick(body, 'isCurrent', 'is_current');
    const jobTitle = pick(body, 'jobTitle', 'job_title');
    const location = pick(body, 'location');
    const startMonth = pick(body, 'startMonth', 'start_month');
    const endMonth = pick(body, 'endMonth', 'end_month');

    if (isCurrent === true) {
      await query('UPDATE companies SET is_current = false WHERE user_id = $1 AND id != $2', [
        userId,
        companyId,
      ]);
    }

    const sets: string[] = [];
    const params: any[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (body.name !== undefined) add('name', typeof body.name === 'string' ? body.name.trim() : null);
    if (body.color !== undefined) add('color', body.color);
    if (isCurrent !== undefined) add('is_current', Boolean(isCurrent));
    if (jobTitle !== undefined) {
      add('job_title', typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim() : null);
    }
    if (location !== undefined) {
      add('location', typeof location === 'string' && location.trim() ? location.trim() : null);
    }
    if (startMonth !== undefined) add('start_month', normalizeMonth(startMonth));
    if (endMonth !== undefined) add('end_month', normalizeMonth(endMonth));

    if (sets.length === 0) {
      res.status(400).json({ error: 'No fields provided to update.' });
      return;
    }

    params.push(companyId, userId);
    const result = await query(
      `UPDATE companies
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id, name, color, is_current, job_title, location, start_month, end_month, created_at`,
      params
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
