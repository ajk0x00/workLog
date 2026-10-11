import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { structuredOutput, FireworksError, currentModel } from '../services/llm.js';
import {
  loadPrompt,
  interpolate,
  parseTemplateRegions,
  renderRegions,
  replaceDataRegion,
} from '../services/prompts.js';

export const resumesRouter = Router();
resumesRouter.use(requireAuth);

const MAX_LOGS = 150;
const CONTENT_TRUNCATE = 500;
const ACHIEVEMENT_TRUNCATE = 300;

interface LogRow {
  log_date: string;
  title: string;
  status: string;
  achievements: string | null;
  blockers: string | null;
  content_markdown: string | null;
  company_name: string | null;
  tag_names: string[];
}

const truncate = (text: string | null, max: number): string => {
  if (!text) return '';
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

async function buildDataDigest(userId: number, companyId?: number | null): Promise<string> {
  const userRes = await query(
    'SELECT full_name, username, email FROM users WHERE id = $1',
    [userId]
  );
  const user = userRes.rows[0];

  const companiesRes = await query(
    `SELECT c.id, c.name, c.is_current,
            MIN(wl.log_date) AS first_log,
            MAX(wl.log_date) AS last_log
     FROM companies c
     LEFT JOIN work_logs wl ON wl.company_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.is_current DESC, last_log DESC NULLS LAST`,
    [userId]
  );

  const logsRes = await query<LogRow>(
    `SELECT wl.log_date, wl.title, wl.status, wl.achievements, wl.blockers,
            wl.content_markdown,
            c.name AS company_name,
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tag_names
     FROM work_logs wl
     LEFT JOIN companies c ON c.id = wl.company_id
     LEFT JOIN log_tags lt ON lt.log_id = wl.id
     LEFT JOIN tags t ON t.id = lt.tag_id
     WHERE wl.user_id = $1 ${companyId ? 'AND wl.company_id = $2' : ''}
     GROUP BY wl.id, c.name
     ORDER BY wl.log_date DESC
     LIMIT ${MAX_LOGS}`,
    companyId ? [userId, companyId] : [userId]
  );

  const skillsRes = await query(
    `SELECT name, category, proficiency, years_experience::float AS years_experience,
            last_used_year, is_active
     FROM skills
     WHERE user_id = $1 AND is_active = true
     ORDER BY proficiency DESC, years_experience DESC`,
    [userId]
  );

  const sections: string[] = [];

  sections.push(
    `# Candidate\nName: ${user.full_name || user.username}\nUsername: ${user.username}\nEmail: ${user.email}`
  );

  if (companiesRes.rows.length > 0) {
    const companyLines = companiesRes.rows.map((c: any) => {
      const span =
        c.first_log && c.last_log
          ? ` (active ${c.first_log} to ${c.last_log}${c.is_current ? ', current employer' : ''})`
          : '';
      return `- ${c.name}${span}`;
    });
    sections.push(`# Employers\n${companyLines.join('\n')}`);
  }

  if (logsRes.rows.length > 0) {
    const logLines = logsRes.rows.map((log) => {
      const parts = [`## ${log.log_date} @ ${log.company_name || 'Unassigned'}`, `Title: ${log.title}`];
      if (log.tag_names.length > 0) parts.push(`Tags: ${log.tag_names.join(', ')}`);
      if (log.status) parts.push(`Status: ${log.status}`);
      const notes = truncate(log.content_markdown, CONTENT_TRUNCATE);
      if (notes) parts.push(`Notes: ${notes}`);
      const achievements = truncate(log.achievements, ACHIEVEMENT_TRUNCATE);
      if (achievements) parts.push(`Achievements: ${achievements}`);
      return parts.join('\n');
    });
    sections.push(
      `# Work Log Entries (most recent ${logLines.length})\n${logLines.join('\n\n')}`
    );
  }

  if (skillsRes.rows.length > 0) {
    const skillLines = skillsRes.rows.map(
      (s: any) =>
        `- ${s.name} (${s.category}) — proficiency ${s.proficiency}/5, ${s.years_experience} yrs experience${
          s.last_used_year ? `, last used ${s.last_used_year}` : ''
        }`
    );
    sections.push(`# Skills Matrix\n${skillLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

interface ProjectAnchor {
  name: string;
  url: string;
  description: string;
}

export async function buildExtraExperienceBlocks(
  userId: number,
  template: string,
  scopedCompanyId: number | null
): Promise<string> {
  const companiesRes = await query(
    `SELECT c.id, c.name, c.job_title, c.location, c.start_month, c.end_month, c.is_current,
            COUNT(wl.id)::int AS log_count,
            MIN(wl.log_date) AS first_log,
            MAX(wl.log_date) AS last_log
     FROM companies c
     LEFT JOIN work_logs wl ON wl.company_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.is_current DESC, MAX(wl.log_date) DESC NULLS LAST`,
    [userId]
  );

  const experienceStart = template.indexOf('# **EXPERIENCE**');
  const educationStart = template.indexOf('# **EDUCATION**');
  const experienceSection =
    experienceStart >= 0
      ? template.slice(experienceStart, educationStart > experienceStart ? educationStart : undefined)
      : '';

  const blocks: string[] = [];
  for (const company of companiesRes.rows) {
    if (scopedCompanyId && company.id !== scopedCompanyId) continue;
    if (company.log_count === 0) continue;
    if (experienceSection.toLowerCase().includes(String(company.name).toLowerCase())) continue;

    let header = company.name;
    if (company.location) header += `, ${company.location}`;
    if (company.job_title) header += ` — *${company.job_title}*`;

    const start = company.start_month || (company.first_log ? String(company.first_log).slice(0, 7) : '');
    const end =
      company.end_month ||
      (company.is_current
        ? 'Present'
        : company.last_log
          ? String(company.last_log).slice(0, 7)
          : 'Present');

    const lines = [`## **${header}**`, ''];
    if (start) lines.push(`${start} \\- ${end}`, '');
    lines.push(`<!-- llm:bullets:company-${company.id} -->`, `<!-- /llm -->`);
    blocks.push(lines.join('\n'));
  }

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

interface ResumeFill {
  headline: string;
  summary: string;
  skills: string;
  bullets?: Record<string, string[]>;
  projects?: Record<string, string>;
  projectOrder?: string[];
}

function parseProjectAnchors(regionContent: string): ProjectAnchor[] {
  const anchors: ProjectAnchor[] = [];
  const regex = /^[-*]\s*\[([^\]]+)\]\(([^)]+)\):?\s*(.*)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(regionContent)) !== null) {
    anchors.push({ name: match[1].trim(), url: match[2].trim(), description: match[3].trim() });
  }
  return anchors;
}

const cleanHeadline = (raw: string) => raw.replace(/^#+\s*/, '').replace(/\n+/g, ' ').trim();
const cleanLine = (raw: string) => raw.replace(/\s*\n+\s*/g, ' ').trim();
const cleanBullet = (raw: string) => raw.replace(/^\s*[-*]\s*/, '').trim();

function buildSchema(roleKeys: string[], projectNames: string[]) {
  const shape: Record<string, z.ZodTypeAny> = {
    headline: z.string().describe('Role title for the headline under the name, e.g. "AI Engineer" or "Backend Engineer", tailored to the target role.'),
    summary: z.string().describe('Professional summary paragraph, 2-4 sentences, tailored to the target role.'),
    skills: z.string().describe('A single comma-separated line of skills, ordered by relevance to the target role.'),
  };

  if (roleKeys.length > 0) {
    shape.bullets = z.object(
      Object.fromEntries(
        roleKeys.map((key) => [
          key,
          z.array(z.string()).describe('Accomplishment bullets for this role, plain text without the * marker.'),
        ])
      )
    ).describe('Bullets keyed by the exact experience role keys listed in the instructions.');
  }

  if (projectNames.length > 0) {
    shape.projects = z.object(
      Object.fromEntries(
        projectNames.map((name) => [
          name,
          z.string().describe('A one-line description of this project angled toward the target role.'),
        ])
      )
    ).describe('Tailored descriptions keyed by the exact project names.');
    shape.projectOrder = z
      .array(z.string())
      .describe('Project names ordered by relevance to the target role.');
  }

  return z.object(shape);
}

function renderBullets(bullets: string[]): string {
  return bullets.map((b) => `* ${b}  `).join('\n');
}

function renderProjects(order: string[], anchors: ProjectAnchor[], descriptions: Record<string, string>): string {
  const byName = new Map(anchors.map((a) => [a.name, a]));
  const ordered = order.filter((name) => byName.has(name));
  for (const anchor of anchors) {
    if (!ordered.includes(anchor.name)) ordered.push(anchor.name);
  }
  return ordered
    .map((name) => {
      const anchor = byName.get(name)!;
      const description = descriptions[name]?.trim() || anchor.description;
      return `* [${name}](${anchor.url}): ${description}  `;
    })
    .join('\n');
}

// Generate a new resume from the user's logged data using their resume template
resumesRouter.post('/generate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { title, targetRole, jobDescription, companyId } = req.body || {};

    const scopedCompanyId =
      companyId !== undefined && companyId !== null && companyId !== '' ? Number(companyId) : null;

    const baseTemplate = await loadPrompt('resume-template');
    const template = replaceDataRegion(
      baseTemplate,
      'experience-extra',
      await buildExtraExperienceBlocks(userId, baseTemplate, scopedCompanyId)
    );
    const regions = parseTemplateRegions(template);
    if (regions.length === 0) {
      res.status(500).json({ error: 'Resume template has no llm regions defined.' });
      return;
    }

    const bulletRegions = regions.filter((r) => r.key.startsWith('bullets:'));
    const roleKeys = bulletRegions.map((r) => r.key.slice('bullets:'.length));
    const projectsRegion = regions.find((r) => r.key === 'projects');
    const projectAnchors = projectsRegion ? parseProjectAnchors(projectsRegion.content) : [];
    const projectNames = projectAnchors.map((a) => a.name);

    const digest = await buildDataDigest(userId, scopedCompanyId);

    const targetRoleBlock = targetRole?.trim()
      ? `\n- Target role: ${targetRole.trim()}. Angle the headline, summary, skills ordering, bullet emphasis, and project ordering toward this role.`
      : '';
    const jobDescriptionBlock = jobDescription?.trim()
      ? `\n## Job description to optimize against (mirror its keywords honestly)\n\n"""\n${jobDescription.trim().slice(0, 6000)}\n"""`
      : '';

    const systemPrompt = await loadPrompt('resume-system');
    const userPrompt = interpolate(await loadPrompt('resume-user'), {
      candidateData: digest || '(no work log data available)',
      template,
      roleKeys: roleKeys.join(', ') || '(none)',
      projectNames: projectNames.join(', ') || '(none)',
      targetRoleBlock,
      jobDescriptionBlock,
    });

    const schema = buildSchema(roleKeys, projectNames);
    const fill = await structuredOutput(schema as unknown as z.ZodType<ResumeFill>, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 4096 });

    // Assemble replacements, falling back to original template content when a region comes back unusable
    const replacements = new Map<string, string>();

    replacements.set('headline', `## ${cleanHeadline(fill.headline)}`);
    replacements.set('summary', cleanLine(fill.summary));
    replacements.set('skills', cleanLine(fill.skills));

    for (const region of bulletRegions) {
      const roleKey = region.key.slice('bullets:'.length);
      const bullets = fill.bullets?.[roleKey] || [];
      const cleaned = bullets.map(cleanBullet).filter(Boolean);
      replacements.set(region.key, cleaned.length > 0 ? renderBullets(cleaned) : region.content);
    }

    if (projectsRegion && fill.projects && fill.projectOrder) {
      const rendered = renderProjects(fill.projectOrder, projectAnchors, fill.projects);
      replacements.set('projects', rendered || projectsRegion.content);
    }

    const content = renderRegions(template, regions, replacements).trim() + '\n';

    const cleanTitle =
      (title?.trim() || (targetRole?.trim() ? `Resume — ${targetRole.trim()}` : `Resume — ${new Date().toISOString().slice(0, 10)}`)).slice(0, 200);

    const result = await query(
      `INSERT INTO resumes (user_id, title, target_role, content_markdown, model)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, target_role, content_markdown, model, created_at`,
      [userId, cleanTitle, targetRole?.trim() || null, content, currentModel()]
    );

    res.status(201).json({ resume: result.rows[0], message: 'Resume generated successfully.' });
  } catch (err: any) {
    if (err instanceof FireworksError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// List saved resumes
resumesRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT id, title, target_role, model, created_at
       FROM resumes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ resumes: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get a single resume with content
resumesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(String(req.params.id), 10);
    const result = await query(
      `SELECT id, title, target_role, content_markdown, model, created_at
       FROM resumes
       WHERE id = $1 AND user_id = $2`,
      [resumeId, userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Resume not found.' });
      return;
    }
    res.json({ resume: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete a saved resume
resumesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const resumeId = parseInt(String(req.params.id), 10);
    const result = await query('DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id', [
      resumeId,
      userId,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Resume not found.' });
      return;
    }
    res.json({ message: 'Resume deleted.' });
  } catch (err) {
    next(err);
  }
});
