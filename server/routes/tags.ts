import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

// Get all tags for logged in user
tagsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT t.id, t.name, t.color, t.created_at,
              COUNT(lt.log_id)::int AS log_count
       FROM tags t
       LEFT JOIN log_tags lt ON t.id = lt.tag_id
       WHERE t.user_id = $1
       GROUP BY t.id, t.name, t.color, t.created_at
       ORDER BY t.name ASC`,
      [userId]
    );

    res.json({ tags: result.rows });
  } catch (err) {
    next(err);
  }
});

// Create new tag
tagsRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Tag name is required.' });
      return;
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cleanColor = color?.trim() || '#6366f1';

    const result = await query(
      `INSERT INTO tags (user_id, name, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, name)
       DO UPDATE SET color = EXCLUDED.color
       RETURNING id, name, color, created_at`,
      [userId, cleanName, cleanColor]
    );

    res.status(201).json({ tag: result.rows[0], message: 'Tag saved.' });
  } catch (err) {
    next(err);
  }
});

// Update tag
tagsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tagId = parseInt(String(req.params.id), 10);
    const { name, color } = req.body;

    const result = await query(
      `UPDATE tags
       SET name = COALESCE($1, name),
           color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, color`,
      [name?.trim().toLowerCase(), color?.trim(), tagId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tag not found.' });
      return;
    }

    res.json({ tag: result.rows[0], message: 'Tag updated.' });
  } catch (err) {
    next(err);
  }
});

// Delete tag
tagsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tagId = parseInt(String(req.params.id), 10);

    const result = await query(
      `DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING id`,
      [tagId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tag not found.' });
      return;
    }

    res.json({ message: 'Tag deleted successfully.' });
  } catch (err) {
    next(err);
  }
});
