import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user daily goal
    const userRes = await query('SELECT daily_goal_hours FROM users WHERE id = $1', [userId]);
    const dailyGoalHours = userRes.rows[0]?.daily_goal_hours ? parseFloat(userRes.rows[0].daily_goal_hours) : 8.0;

    // Today's total minutes
    const todayRes = await query(
      `SELECT COALESCE(SUM(duration_minutes), 0)::int AS today_minutes,
              COUNT(id)::int AS today_count,
              COUNT(CASE WHEN status = 'done' THEN 1 END)::int AS today_done,
              COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS today_in_progress,
              COUNT(CASE WHEN status = 'blocked' THEN 1 END)::int AS today_blocked
       FROM work_logs
       WHERE user_id = $1 AND log_date = CURRENT_DATE`,
      [userId]
    );

    // This week's total minutes
    const weekRes = await query(
      `SELECT COALESCE(SUM(duration_minutes), 0)::int AS week_minutes,
              COUNT(id)::int AS week_count
       FROM work_logs
       WHERE user_id = $1 AND log_date >= DATE_TRUNC('week', CURRENT_DATE)`,
      [userId]
    );

    // Last 7 days daily breakdown
    const last7DaysRes = await query(
      `WITH dates AS (
         SELECT (CURRENT_DATE - i)::date AS d
         FROM generate_series(6, 0, -1) AS i
       )
       SELECT
         TO_CHAR(d.d, 'YYYY-MM-DD') AS date_str,
         TO_CHAR(d.d, 'Dy') AS day_name,
         COALESCE(SUM(wl.duration_minutes), 0)::int AS minutes,
         COUNT(wl.id)::int AS count
       FROM dates d
       LEFT JOIN work_logs wl ON wl.user_id = $1 AND wl.log_date = d.d
       GROUP BY d.d
       ORDER BY d.d ASC`,
      [userId]
    );

    // Tag breakdown
    const tagRes = await query(
      `SELECT t.name, t.color,
              COALESCE(SUM(wl.duration_minutes), 0)::int AS total_minutes,
              COUNT(wl.id)::int AS log_count
       FROM tags t
       JOIN log_tags lt ON t.id = lt.tag_id
       JOIN work_logs wl ON lt.log_id = wl.id
       WHERE t.user_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY total_minutes DESC
       LIMIT 8`,
      [userId]
    );

    // Calculate streak (consecutive days with at least 1 log entry up to today or yesterday)
    const logDatesRes = await query(
      `SELECT DISTINCT log_date::date AS log_date
       FROM work_logs
       WHERE user_id = $1
       ORDER BY log_date DESC`,
      [userId]
    );

    let streak = 0;
    if (logDatesRes.rows.length > 0) {
      const dates = logDatesRes.rows.map((r) => new Date(r.log_date).toISOString().split('T')[0]);
      const today = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      let checkDate = dates.includes(today) ? new Date() : dates.includes(yesterday) ? yesterdayDate : null;

      if (checkDate) {
        let curr = new Date(checkDate);
        while (true) {
          const dateStr = curr.toISOString().split('T')[0];
          if (dates.includes(dateStr)) {
            streak++;
            curr.setDate(curr.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    const todayStats = todayRes.rows[0];
    const weekStats = weekRes.rows[0];
    const todayHours = Math.round((todayStats.today_minutes / 60) * 10) / 10;
    const weekHours = Math.round((weekStats.week_minutes / 60) * 10) / 10;
    const goalPercentage = Math.min(100, Math.round((todayHours / dailyGoalHours) * 100));

    res.json({
      streak,
      dailyGoalHours,
      today: {
        minutes: todayStats.today_minutes,
        hours: todayHours,
        goalPercentage,
        count: todayStats.today_count,
        done: todayStats.today_done,
        inProgress: todayStats.today_in_progress,
        blocked: todayStats.today_blocked,
      },
      week: {
        minutes: weekStats.week_minutes,
        hours: weekHours,
        count: weekStats.week_count,
      },
      last7Days: last7DaysRes.rows,
      tags: tagRes.rows,
    });
  } catch (err) {
    next(err);
  }
});
