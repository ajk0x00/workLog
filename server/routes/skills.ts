import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const skillsRouter = Router();
skillsRouter.use(requireAuth);

// Get all skills for logged-in user
skillsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT id, name, category, proficiency,
              years_experience::float AS years_experience,
              COALESCE(last_used_year, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS last_used_year,
              is_active, created_at, updated_at
       FROM skills
       WHERE user_id = $1
       ORDER BY is_active DESC, category ASC, proficiency DESC, name ASC`,
      [userId]
    );

    res.json({ skills: result.rows });
  } catch (err) {
    next(err);
  }
});

// Create new skill
skillsRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, category, proficiency, yearsExperience, lastUsedYear, lastUsedAt, isActive } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Skill name is required.' });
      return;
    }

    const currentYear = new Date().getFullYear();
    const cleanName = name.trim();
    const cleanCategory = category?.trim() || 'General';
    const cleanProficiency = Math.max(1, Math.min(5, Number(proficiency) || 3));
    const cleanExperience = Math.max(0, Number(yearsExperience) || 1.0);
    const cleanLastUsedYear = Number(lastUsedYear) || (lastUsedAt ? new Date(lastUsedAt).getFullYear() : currentYear);
    const cleanIsActive = isActive !== undefined ? Boolean(isActive) : true;

    const result = await query(
      `INSERT INTO skills (user_id, name, category, proficiency, years_experience, last_used_year, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, category, proficiency,
                 years_experience::float AS years_experience,
                 COALESCE(last_used_year, $6) AS last_used_year,
                 is_active, created_at, updated_at`,
      [userId, cleanName, cleanCategory, cleanProficiency, cleanExperience, cleanLastUsedYear, cleanIsActive]
    );

    res.status(201).json({ skill: result.rows[0], message: 'Skill added to matrix.' });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Skill already exists in your matrix.' });
      return;
    }
    next(err);
  }
});

// Update skill
skillsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const skillId = parseInt(String(req.params.id), 10);
    const { name, category, proficiency, yearsExperience, lastUsedYear, lastUsedAt, isActive } = req.body;

    const cleanProficiency = proficiency !== undefined ? Math.max(1, Math.min(5, Number(proficiency))) : undefined;
    const cleanExperience = yearsExperience !== undefined ? Math.max(0, Number(yearsExperience)) : undefined;
    const cleanLastUsedYear = lastUsedYear !== undefined ? Number(lastUsedYear) : (lastUsedAt ? new Date(lastUsedAt).getFullYear() : undefined);
    const cleanIsActive = isActive !== undefined ? Boolean(isActive) : undefined;

    const result = await query(
      `UPDATE skills
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           proficiency = COALESCE($3, proficiency),
           years_experience = COALESCE($4, years_experience),
           last_used_year = COALESCE($5, last_used_year),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING id, name, category, proficiency,
                 years_experience::float AS years_experience,
                 COALESCE(last_used_year, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS last_used_year,
                 is_active, created_at, updated_at`,
      [name?.trim(), category?.trim(), cleanProficiency, cleanExperience, cleanLastUsedYear, cleanIsActive, skillId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Skill not found.' });
      return;
    }

    res.json({ skill: result.rows[0], message: 'Skill updated.' });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'A skill with this name already exists.' });
      return;
    }
    next(err);
  }
});

// Delete skill
skillsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const skillId = parseInt(String(req.params.id), 10);

    const result = await query('DELETE FROM skills WHERE id = $1 AND user_id = $2 RETURNING id', [
      skillId,
      userId,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Skill not found.' });
      return;
    }

    res.json({ message: 'Skill removed from matrix.' });
  } catch (err) {
    next(err);
  }
});
