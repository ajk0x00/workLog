import { Router, Request, Response, NextFunction } from 'express';
import { query, pool } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const logsRouter = Router();
logsRouter.use(requireAuth);

// Helper to format logs with attached tags
async function fetchLogsWithTags(whereClause: string, params: any[]) {
  const sql = `
    SELECT
      wl.id,
      wl.user_id,
      TO_CHAR(wl.log_date, 'YYYY-MM-DD') AS log_date,
      wl.title,
      wl.content_markdown,
      wl.status,
      wl.blockers,
      wl.achievements,
      wl.created_at,
      wl.updated_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) AS tags
    FROM work_logs wl
    LEFT JOIN log_tags lt ON wl.id = lt.log_id
    LEFT JOIN tags t ON lt.tag_id = t.id
    ${whereClause}
    GROUP BY wl.id
    ORDER BY wl.log_date DESC, wl.created_at DESC
  `;
  const result = await query(sql, params);
  return result.rows;
}

// Helper to attach tags to a log
async function attachTagsToLog(client: any, userId: number, logId: number, tagNames: string[]) {
  // Clear existing links
  await client.query('DELETE FROM log_tags WHERE log_id = $1', [logId]);

  if (!tagNames || tagNames.length === 0) return;

  for (const rawName of tagNames) {
    if (!rawName || typeof rawName !== 'string') continue;
    const name = rawName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!name) continue;

    // Get or create tag
    let tagRes = await client.query(
      'SELECT id FROM tags WHERE user_id = $1 AND name = $2',
      [userId, name]
    );

    let tagId: number;
    if (tagRes.rows.length === 0) {
      const newTag = await client.query(
        'INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) RETURNING id',
        [userId, name, '#6366f1']
      );
      tagId = newTag.rows[0].id;
    } else {
      tagId = tagRes.rows[0].id;
    }

    // Link tag to log
    await client.query(
      'INSERT INTO log_tags (log_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [logId, tagId]
    );
  }
}

// List all logs with search and filters
logsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { search, startDate, endDate, tag, status, limit, offset } = req.query;

    const conditions: string[] = ['wl.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`wl.log_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`wl.log_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (status && (status === 'done' || status === 'in_progress' || status === 'blocked')) {
      conditions.push(`wl.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(wl.title) LIKE $${paramIndex} OR LOWER(wl.content_markdown) LIKE $${paramIndex} OR LOWER(wl.blockers) LIKE $${paramIndex} OR LOWER(wl.achievements) LIKE $${paramIndex})`
      );
      params.push(searchTerm);
      paramIndex++;
    }

    if (tag && typeof tag === 'string' && tag.trim()) {
      conditions.push(
        `wl.id IN (SELECT lt2.log_id FROM log_tags lt2 JOIN tags t2 ON lt2.tag_id = t2.id WHERE t2.user_id = $1 AND t2.name = $${paramIndex})`
      );
      params.push(tag.trim().toLowerCase());
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const logs = await fetchLogsWithTags(whereClause, params);

    // Group logs by date
    const groupedByDate: Record<string, typeof logs> = {};
    for (const log of logs) {
      const dateKey = log.log_date;
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(log);
    }

    res.json({
      total: logs.length,
      logs,
      grouped: groupedByDate,
    });
  } catch (err) {
    next(err);
  }
});

// Export logs in Markdown, CSV, or JSON
logsRouter.get('/export/:format', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const format = String(req.params.format).toLowerCase();
    const logs = await fetchLogsWithTags('WHERE wl.user_id = $1', [userId]);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="worklog-export.json"');
      res.send(JSON.stringify(logs, null, 2));
      return;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="worklog-export.csv"');
      let csv = 'ID,Date,Title,Status,Tags,Blockers,Achievements,Created At\n';
      for (const l of logs) {
        const tagNames = l.tags.map((t: any) => t.name).join('; ');
        csv += `"${l.id}","${l.log_date}","${(l.title || '').replace(/"/g, '""')}","${l.status}","${tagNames}","${(l.blockers || '').replace(/"/g, '""')}","${(l.achievements || '').replace(/"/g, '""')}","${l.created_at}"\n`;
      }
      res.send(csv);
      return;
    }

    if (format === 'markdown' || format === 'md') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="worklog-export.md"');
      let md = `# 📝 Work Log Export\n\n*Generated on ${new Date().toLocaleDateString()}*\n\n`;
      for (const l of logs) {
        const tags = l.tags.map((t: any) => `\`#${t.name}\``).join(' ');
        md += `## [${l.log_date}] ${l.title} (${l.status.toUpperCase()})\n`;
        md += `- **Tags**: ${tags || 'None'}\n\n`;
        if (l.content_markdown) {
          md += `${l.content_markdown}\n\n`;
        }
        if (l.blockers) {
          md += `> **Blockers**: ${l.blockers}\n\n`;
        }
        if (l.achievements) {
          md += `> **Achievements**: ${l.achievements}\n\n`;
        }
        md += `---\n\n`;
      }
      res.send(md);
      return;
    }

    res.status(400).json({ error: 'Unsupported format. Choose json, csv, or markdown.' });
  } catch (err) {
    next(err);
  }
});

// Get single log
logsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const logId = parseInt(String(req.params.id), 10);
    const logs = await fetchLogsWithTags('WHERE wl.user_id = $1 AND wl.id = $2', [userId, logId]);

    if (logs.length === 0) {
      res.status(404).json({ error: 'Log entry not found.' });
      return;
    }

    res.json({ log: logs[0] });
  } catch (err) {
    next(err);
  }
});

// Create new log entry
logsRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = await pool.connect();
  try {
    const userId = req.user!.id;
    const {
      title,
      logDate,
      contentMarkdown,
      status,
      blockers,
      achievements,
      tags,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Work title is required.' });
      return;
    }

    await client.query('BEGIN');

    const cleanDate = logDate || new Date().toISOString().split('T')[0];
    const cleanStatus = ['done', 'in_progress', 'blocked'].includes(status) ? status : 'done';

    const insertSql = `
      INSERT INTO work_logs (user_id, log_date, title, content_markdown, status, blockers, achievements)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date, title, content_markdown, status, blockers, achievements, created_at, updated_at
    `;

    const result = await client.query(insertSql, [
      userId,
      cleanDate,
      title.trim(),
      contentMarkdown || '',
      cleanStatus,
      blockers?.trim() || '',
      achievements?.trim() || '',
    ]);

    const createdLog = result.rows[0];

    if (Array.isArray(tags) && tags.length > 0) {
      await attachTagsToLog(client, userId, createdLog.id, tags);
    }

    await client.query('COMMIT');

    const fullLogs = await fetchLogsWithTags('WHERE wl.user_id = $1 AND wl.id = $2', [
      userId,
      createdLog.id,
    ]);

    res.status(201).json({
      log: fullLogs[0],
      message: 'Work log recorded.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Update log entry
logsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = await pool.connect();
  try {
    const userId = req.user!.id;
    const logId = parseInt(String(req.params.id), 10);
    const {
      title,
      logDate,
      contentMarkdown,
      status,
      blockers,
      achievements,
      tags,
    } = req.body;

    await client.query('BEGIN');

    const cleanDate = logDate ? logDate : undefined;
    const cleanStatus = status && ['done', 'in_progress', 'blocked'].includes(status) ? status : undefined;

    const updateSql = `
      UPDATE work_logs
      SET title = COALESCE($1, title),
          log_date = COALESCE($2::DATE, log_date),
          content_markdown = COALESCE($3, content_markdown),
          status = COALESCE($4, status),
          blockers = COALESCE($5, blockers),
          achievements = COALESCE($6, achievements),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING id
    `;

    const result = await client.query(updateSql, [
      title?.trim(),
      cleanDate,
      contentMarkdown,
      cleanStatus,
      blockers,
      achievements,
      logId,
      userId,
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Log entry not found.' });
      return;
    }

    if (Array.isArray(tags)) {
      await attachTagsToLog(client, userId, logId, tags);
    }

    await client.query('COMMIT');

    const fullLogs = await fetchLogsWithTags('WHERE wl.user_id = $1 AND wl.id = $2', [
      userId,
      logId,
    ]);

    res.json({
      log: fullLogs[0],
      message: 'Work log updated.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Quick status toggle
logsRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const logId = parseInt(String(req.params.id), 10);
    const { status } = req.body;

    if (!['done', 'in_progress', 'blocked'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }

    const result = await query(
      `UPDATE work_logs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, status`,
      [status, logId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Log entry not found.' });
      return;
    }

    res.json({ id: logId, status: result.rows[0].status, message: 'Status updated.' });
  } catch (err) {
    next(err);
  }
});

// Delete log entry
logsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const logId = parseInt(String(req.params.id), 10);

    const result = await query(
      'DELETE FROM work_logs WHERE id = $1 AND user_id = $2 RETURNING id',
      [logId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Log entry not found.' });
      return;
    }

    res.json({ message: 'Log deleted successfully.' });
  } catch (err) {
    next(err);
  }
});
