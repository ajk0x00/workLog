#!/usr/bin/env node
/**
 * Export all WorkLog data to a JSON dump for migration to careerTrack.
 *
 * Usage:
 *   node scripts/export_data.js -o worklog_export.json
 *   node scripts/export_data.js --email user@example.com -o export.json
 *   node scripts/export_data.js --db-url "postgresql://..." -o export.json
 *   npm run export:data -- -o worklog_export.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

function hasFlag(flag, longFlag) {
  return args.includes(flag) || (longFlag && args.includes(longFlag));
}

function getArg(flag, longFlag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || args[i] === longFlag) {
      return args[i + 1];
    }
    if (longFlag && args[i].startsWith(`${longFlag}=`)) {
      return args[i].slice(longFlag.length + 1);
    }
  }
  return null;
}

if (hasFlag('-h', '--help')) {
  console.log(`
Usage: node scripts/export_data.js [options]

Options:
  -o, --output <file>         Write JSON to file path (defaults to stdout)
  -e, --email <email>         Export data only for a specific user email
  -u, --user-id <id>          Export data only for a specific user ID
  -d, --db-url <url>          PostgreSQL connection string (overrides DATABASE_URL)
  -h, --help                  Show this help message

Examples:
  node scripts/export_data.js -o worklog_export.json
  node scripts/export_data.js --email alex@example.com -o export.json
  npm run export:data -- -o worklog_export.json
`);
  process.exit(0);
}

// Load .env from root if not already in env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const dbUrlArg = getArg('-d', '--db-url') || getArg(null, '--database-url');
const emailArg = getArg('-e', '--email');
const userIdArg = getArg('-u', '--user-id');
const outputArg = getArg('-o', '--output');

let connString = dbUrlArg || process.env.DATABASE_URL;
if (!connString) {
  const host = process.env.POSTGRES_SERVER || process.env.DB_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || process.env.DB_PORT || '5432';
  const user = process.env.POSTGRES_USER || process.env.DB_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres';
  const database = process.env.POSTGRES_DB || process.env.DB_NAME || 'worklog';
  connString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

const useSsl =
  (process.env.DB_SSL && ['true', '1'].includes(process.env.DB_SSL.toLowerCase())) ||
  connString.includes('sslmode=require') ||
  connString.includes('neon.tech') ||
  connString.includes('supabase.co');

const pool = new pg.Pool({
  connectionString: connString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function tableExists(client, tableName) {
  const res = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName]
  );
  return res.rows[0].exists;
}

async function exportData() {
  const client = await pool.connect();
  try {
    const hasCompanies = await tableExists(client, 'companies');
    const hasSkills = await tableExists(client, 'skills');
    const hasTags = await tableExists(client, 'tags');
    const hasLogTags = await tableExists(client, 'log_tags');
    const hasWorkLogs = await tableExists(client, 'work_logs');
    const hasResumes = await tableExists(client, 'resumes');

    let userQuery = `SELECT id, username, email, full_name, theme_preference, created_at, updated_at FROM users`;
    const userParams = [];
    const conditions = [];

    if (emailArg) {
      userParams.push(emailArg.trim().toLowerCase());
      conditions.push(`LOWER(email) = $${userParams.length}`);
    }
    if (userIdArg) {
      userParams.push(parseInt(userIdArg, 10));
      conditions.push(`id = $${userParams.length}`);
    }

    if (conditions.length > 0) {
      userQuery += ` WHERE ` + conditions.join(' AND ');
    }
    userQuery += ` ORDER BY id ASC`;

    const userRes = await client.query(userQuery, userParams);
    if (userRes.rows.length === 0) {
      console.error('No matching users found to export.');
      process.exit(1);
    }

    const exportPayload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'workLog',
      users: [],
    };

    let totalCompanies = 0;
    let totalSkills = 0;
    let totalLogs = 0;
    let totalResumes = 0;

    for (const user of userRes.rows) {
      const uid = user.id;

      // 1. Companies
      let companies = [];
      const companyMap = new Map();
      if (hasCompanies) {
        const compRes = await client.query(
          `SELECT id, name, color, is_current, job_title, location, start_month, end_month, created_at
           FROM companies
           WHERE user_id = $1
           ORDER BY id ASC`,
          [uid]
        );
        companies = compRes.rows;
        for (const c of companies) {
          companyMap.set(c.id, c.name);
        }
        totalCompanies += companies.length;
      }

      // 2. Skills
      let skills = [];
      if (hasSkills) {
        const skillRes = await client.query(
          `SELECT id, name, category, proficiency,
                  years_experience::float AS years_experience,
                  last_used_year, is_active, created_at, updated_at
           FROM skills
           WHERE user_id = $1
           ORDER BY category ASC, name ASC`,
          [uid]
        );
        skills = skillRes.rows;
        totalSkills += skills.length;
      }

      // 3. Tags
      let tags = [];
      if (hasTags) {
        const tagRes = await client.query(
          `SELECT id, name, color, created_at
           FROM tags
           WHERE user_id = $1
           ORDER BY name ASC`,
          [uid]
        );
        tags = tagRes.rows;
      }

      // 4. Work Logs
      let workLogs = [];
      if (hasWorkLogs) {
        let logQuery = '';
        if (hasLogTags && hasTags) {
          logQuery = `
            SELECT
              wl.id,
              TO_CHAR(wl.log_date, 'YYYY-MM-DD') AS log_date,
              wl.title,
              wl.content_markdown,
              wl.status,
              wl.blockers,
              wl.achievements,
              wl.company_id,
              wl.created_at,
              wl.updated_at,
              COALESCE(
                ARRAY_AGG(t.name) FILTER (WHERE t.id IS NOT NULL),
                ARRAY[]::varchar[]
              ) AS tags
            FROM work_logs wl
            LEFT JOIN log_tags lt ON wl.id = lt.log_id
            LEFT JOIN tags t ON lt.tag_id = t.id
            WHERE wl.user_id = $1
            GROUP BY wl.id
            ORDER BY wl.log_date DESC, wl.created_at DESC
          `;
        } else {
          logQuery = `
            SELECT
              id,
              TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date,
              title,
              content_markdown,
              status,
              blockers,
              achievements,
              company_id,
              created_at,
              updated_at,
              ARRAY[]::varchar[] AS tags
            FROM work_logs
            WHERE user_id = $1
            ORDER BY log_date DESC, created_at DESC
          `;
        }
        const logRes = await client.query(logQuery, [uid]);
        workLogs = logRes.rows.map((row) => ({
          ...row,
          company_name: row.company_id ? companyMap.get(row.company_id) || null : null,
        }));
        totalLogs += workLogs.length;
      }

      // 5. Resumes
      let resumes = [];
      if (hasResumes) {
        const resumeRes = await client.query(
          `SELECT id, title, target_role, content_markdown, model, created_at
           FROM resumes
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [uid]
        );
        resumes = resumeRes.rows;
        totalResumes += resumes.length;
      }

      exportPayload.users.push({
        profile: user,
        companies,
        skills,
        tags,
        work_logs: workLogs,
        resumes,
      });
    }

    exportPayload.summary = {
      total_users: userRes.rows.length,
      total_companies: totalCompanies,
      total_skills: totalSkills,
      total_work_logs: totalLogs,
      total_resumes: totalResumes,
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);

    if (outputArg) {
      const outPath = path.resolve(process.cwd(), outputArg);
      fs.writeFileSync(outPath, jsonStr, 'utf-8');
      console.error(`✓ Successfully exported data to: ${outPath}`);
      console.error(
        `  Users: ${exportPayload.summary.total_users}, ` +
        `Companies: ${exportPayload.summary.total_companies}, ` +
        `Skills: ${exportPayload.summary.total_skills}, ` +
        `Work Logs: ${exportPayload.summary.total_work_logs}, ` +
        `Resumes: ${exportPayload.summary.total_resumes}`
      );
    } else {
      process.stdout.write(jsonStr + '\n');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

exportData().catch((err) => {
  console.error('[Export Error]:', err.message || err);
  process.exit(1);
});
