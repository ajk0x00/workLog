import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');
const cache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached && config.nodeEnv !== 'development') return cached;

  const file = path.join(PROMPTS_DIR, `${name}.md`);
  const content = await fs.promises.readFile(file, 'utf-8');
  if (config.nodeEnv !== 'development') cache.set(name, content);
  return content;
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Prompt template is missing a value for {{${key}}}`);
    }
    return vars[key];
  });
}

export interface TemplateRegion {
  key: string;
  content: string;
  replaceStart: number;
  replaceEnd: number;
}

const OPEN_MARKER = /^<!--\s*llm:([\w:.-]+)\s*-->$/;
const CLOSE_MARKER = /^<!--\s*\/llm\s*-->$/;

export function parseTemplateRegions(template: string): TemplateRegion[] {
  const lines = template.split('\n');
  const regions: TemplateRegion[] = [];
  let openIdx: { key: string; line: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const openMatch = line.match(OPEN_MARKER);
    if (openMatch) {
      openIdx = { key: openMatch[1], line: i };
      continue;
    }
    if (line.match(CLOSE_MARKER) && openIdx) {
      const contentStart = openIdx.line + 1;
      const contentEnd = i;
      const content = lines
        .slice(contentStart, contentEnd)
        .join('\n')
        .replace(/^\n+/, '')
        .replace(/\s+$/, '');
      regions.push({
        key: openIdx.key,
        content,
        replaceStart: openIdx.line,
        replaceEnd: i,
      });
      openIdx = null;
    }
  }

  if (openIdx) {
    throw new Error(`Resume template has an unclosed llm marker: ${openIdx.key}`);
  }
  return regions;
}

export function renderRegions(
  template: string,
  regions: TemplateRegion[],
  replacements: Map<string, string>
): string {
  const lines = template.split('\n');
  const result: string[] = [];
  let inRegion = false;
  let region: TemplateRegion | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const openMatch = trimmed.match(OPEN_MARKER);
    if (openMatch) {
      region = regions.find((r) => r.key === openMatch[1]) || null;
      inRegion = true;
      const replacement = region ? replacements.get(region.key) : undefined;
      if (region && replacement !== undefined) {
        result.push(...replacement.split('\n'));
      } else if (region) {
        result.push(...region.content.split('\n'));
      }
      continue;
    }

    if (inRegion && trimmed.match(CLOSE_MARKER)) {
      inRegion = false;
      region = null;
      continue;
    }

    if (!inRegion) {
      result.push(line);
    }
  }

  return result.join('\n');
}

export function replaceDataRegion(template: string, name: string, content: string): string {
  const regex = new RegExp(`^[ \\t]*<!--\\s*data:${name}\\s*-->\\r?\\n?`, 'm');
  if (!regex.test(template)) {
    throw new Error(`Template is missing the data:${name} region marker`);
  }
  return template.replace(regex, content);
}
