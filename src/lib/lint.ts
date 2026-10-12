import { statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { findSkillDirs, loadSkill, type Skill } from './skill.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  rule: string;
  severity: Severity;
  message: string;
}

export interface SkillReport {
  dir: string;
  skillFile: string;
  issues: Issue[];
}

export interface LintResult {
  reports: SkillReport[];
  summary: { skills: number; errors: number; warnings: number; infos: number };
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'license',
  'version',
  'author',
  'allowed-tools',
  'metadata',
  'compatibility',
  'homepage',
  'repository',
  'keywords',
]);
const PLACEHOLDER_RE = /\b(TODO|TBD|FIXME|XXX|PLACEHOLDER)\b/;
const TRIGGER_RE = /(use when|use this|when to use|when the user|trigger|when working)/i;

/** Run all lint rules for a single skill. */
export function lintSkill(skill: Skill): Issue[] {
  const issues: Issue[] = [];
  const push = (rule: string, severity: Severity, message: string): void => {
    issues.push({ rule, severity, message });
  };

  for (const e of skill.fmErrors) push('frontmatter', 'error', e);

  const fm = skill.frontmatter;
  const name = typeof fm.name === 'string' ? fm.name : '';
  const description = typeof fm.description === 'string' ? fm.description : '';

  if (name.trim() === '') {
    push('name-missing', 'error', 'frontmatter is missing the required "name" field');
  } else {
    if (!NAME_RE.test(name)) {
      push(
        'name-format',
        'error',
        `name "${name}" must be kebab-case: lowercase letters, digits, and dashes`,
      );
    }
    if (name.length > 64) {
      push('name-too-long', 'error', `name is ${name.length} characters; the maximum is 64`);
    }
    if (basename(skill.dir) !== name) {
      push(
        'name-dir-mismatch',
        'warning',
        `name "${name}" does not match directory "${basename(skill.dir)}"`,
      );
    }
  }

  if (description.trim() === '') {
    push('description-missing', 'error', 'frontmatter is missing the required "description" field');
  } else {
    if (description.length < 40) {
      push('description-short', 'warning', `description is ${description.length} characters; aim for 40 or more`);
    }
    if (description.length > 1024) {
      push(
        'description-long',
        'warning',
        `description is ${description.length} characters; the suggested maximum is 1024`,
      );
    }
    if (!TRIGGER_RE.test(description)) {
      push('description-trigger', 'info', 'description may lack trigger guidance; add a phrase like "Use when ..."');
    }
  }

  for (const key of Object.keys(fm)) {
    if (!ALLOWED_KEYS.has(key)) push('unknown-key', 'warning', `unknown frontmatter key "${key}"`);
  }

  if (PLACEHOLDER_RE.test(skill.body) || PLACEHOLDER_RE.test(description)) {
    push('placeholder', 'warning', 'unfinished placeholder text found (TODO/TBD/FIXME/XXX)');
  }

  const body = skill.body.trim();
  if (body === '') {
    push('body-empty', 'error', 'skill body is empty; add instructions for the agent');
  } else {
    const lines = skill.body.split(/\r?\n/).length;
    if (lines > 500) {
      push(
        'body-too-long',
        'warning',
        `body has ${lines} lines; keep SKILL.md under 500 lines and move details to references/`,
      );
    }
  }

  return issues;
}

/** Lint one or more paths. Each path may be a skill, a SKILL.md file, or a collection. */
export function lintPaths(paths: string[]): LintResult {
  const reports: SkillReport[] = [];
  const loaded: Array<{ skill: Skill; report: SkillReport }> = [];

  for (const p of paths) {
    const target = normalizeTarget(p);
    if (target === null) {
      reports.push({
        dir: p,
        skillFile: p,
        issues: [{ rule: 'not-markdown', severity: 'error', message: `${p} is not a SKILL.md file` }],
      });
      continue;
    }
    const dirs = findSkillDirs(target);
    if (dirs.length === 0) {
      reports.push({
        dir: target,
        skillFile: join(target, 'SKILL.md'),
        issues: [{ rule: 'no-skill', severity: 'error', message: `no SKILL.md found under ${target}` }],
      });
      continue;
    }
    for (const d of dirs) {
      const skill = loadSkill(d);
      if (!skill) continue;
      const report: SkillReport = {
        dir: skill.dir,
        skillFile: skill.skillFile,
        issues: lintSkill(skill),
      };
      reports.push(report);
      loaded.push({ skill, report });
    }
  }

  // Duplicate names across the scanned set.
  const byName = new Map<string, Array<{ skill: Skill; report: SkillReport }>>();
  for (const item of loaded) {
    const name = typeof item.skill.frontmatter.name === 'string' ? item.skill.frontmatter.name : '';
    if (name === '') continue;
    const list = byName.get(name) ?? [];
    list.push(item);
    byName.set(name, list);
  }
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    for (const item of list) {
      const others = list.filter((x) => x !== item).map((x) => x.report.dir);
      item.report.issues.push({
        rule: 'duplicate-name',
        severity: 'warning',
        message: `duplicate skill name "${name}"; also found in ${others.join(', ')}`,
      });
    }
  }

  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const report of reports) {
    for (const issue of report.issues) {
      if (issue.severity === 'error') errors++;
      else if (issue.severity === 'warning') warnings++;
      else infos++;
    }
  }

  return { reports, summary: { skills: loaded.length, errors, warnings, infos } };
}

function normalizeTarget(p: string): string | null {
  const resolved = resolve(p);
  try {
    const st = statSync(resolved);
    if (st.isFile()) {
      if (basename(resolved).toLowerCase() !== 'skill.md') return null;
      return dirname(resolved);
    }
  } catch {
    // Missing path: treat it as a directory candidate. Discovery reports it.
  }
  return resolved;
}