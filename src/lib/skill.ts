import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

export interface Skill {
  /** Directory that contains SKILL.md. */
  dir: string;
  /** Path to the SKILL.md file. */
  skillFile: string;
  /** Parsed frontmatter key-value pairs. */
  frontmatter: Record<string, string | string[]>;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** Full raw file contents. */
  raw: string;
  /** Hard frontmatter parse errors. */
  fmErrors: string[];
}

/** Load a skill from a directory. Returns null when SKILL.md is absent. */
export function loadSkill(dir: string): Skill | null {
  const skillFile = join(dir, 'SKILL.md');
  let raw: string;
  try {
    raw = readFileSync(skillFile, 'utf8');
  } catch {
    return null;
  }
  const fm = parseFrontmatter(raw);
  return {
    dir,
    skillFile,
    frontmatter: fm.data,
    body: fm.body,
    raw,
    fmErrors: fm.errors,
  };
}

/** Directory names skipped during skill discovery. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'vendor',
  '__pycache__',
  'coverage',
]);

/** Dot-directories that may host skills and should still be scanned. */
const ALLOWED_DOT_DIRS = new Set(['.claude', '.agents', '.cursor', '.github']);

const MAX_DEPTH = 4;

/**
 * Find skill directories under a root path.
 * When the root itself holds a SKILL.md, the root is returned.
 */
export function findSkillDirs(root: string): string[] {
  if (loadSkill(root)) return [root];
  const out: string[] = [];
  walk(root, 0, out);
  return out;
}

function walk(dir: string, depth: number, out: string[]): void {
  if (depth > MAX_DEPTH) return;
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue;
    const p = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    if (loadSkill(p)) {
      out.push(p);
      continue; // Do not descend into a skill.
    }
    walk(p, depth + 1, out);
  }
}