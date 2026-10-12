import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintSkill, lintPaths } from '../src/lib/lint.js';
import type { Skill } from '../src/lib/skill.js';

function makeSkill(
  partial: {
    dir?: string;
    fm?: Record<string, string | string[]>;
    body?: string;
    fmErrors?: string[];
  } = {},
): Skill {
  const dir = partial.dir ?? join('/', 'skills', 'my-skill');
  return {
    dir,
    skillFile: join(dir, 'SKILL.md'),
    frontmatter: partial.fm ?? {},
    body: partial.body ?? '# My Skill\n\nDo things well.\n',
    raw: '',
    fmErrors: partial.fmErrors ?? [],
  };
}

const GOOD_DESC = 'Use when you need to do my-skill things in tests and demos.';

test('clean skill reports no issues', () => {
  const skill = makeSkill({ fm: { name: 'my-skill', description: GOOD_DESC } });
  assert.deepEqual(lintSkill(skill), []);
});

test('flags non-kebab-case names', () => {
  const skill = makeSkill({
    fm: { name: 'My Skill', description: GOOD_DESC },
  });
  const issues = lintSkill(skill);
  assert.ok(issues.some((i) => i.rule === 'name-format' && i.severity === 'error'));
});

test('flags missing name', () => {
  const skill = makeSkill({ fm: { description: GOOD_DESC } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'name-missing' && i.severity === 'error'));
});

test('flags missing description', () => {
  const skill = makeSkill({ fm: { name: 'my-skill' } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'description-missing' && i.severity === 'error'));
});

test('warns on short descriptions', () => {
  const skill = makeSkill({ fm: { name: 'my-skill', description: 'Too short.' } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'description-short' && i.severity === 'warning'));
});

test('warns on long descriptions', () => {
  const skill = makeSkill({ fm: { name: 'my-skill', description: 'x'.repeat(1100) } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'description-long' && i.severity === 'warning'));
});

test('reports missing trigger guidance as info', () => {
  const skill = makeSkill({
    fm: { name: 'my-skill', description: 'Parses files and reports errors in a friendly way.' },
  });
  const triggers = lintSkill(skill).filter((i) => i.rule === 'description-trigger');
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0]?.severity, 'info');
});

test('warns on unknown keys', () => {
  const skill = makeSkill({ fm: { name: 'my-skill', description: GOOD_DESC, foo: 'bar' } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'unknown-key' && i.severity === 'warning'));
});

test('warns when the name does not match the directory', () => {
  const skill = makeSkill({ fm: { name: 'other-name', description: GOOD_DESC } });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'name-dir-mismatch' && i.severity === 'warning'));
});

test('flags empty bodies', () => {
  const skill = makeSkill({ fm: { name: 'my-skill', description: GOOD_DESC }, body: '   \n' });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'body-empty' && i.severity === 'error'));
});

test('warns on placeholder text', () => {
  const skill = makeSkill({
    fm: { name: 'my-skill', description: GOOD_DESC },
    body: '# My Skill\n\nTODO: finish this section\n',
  });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'placeholder' && i.severity === 'warning'));
});

test('warns on very long bodies', () => {
  const skill = makeSkill({
    fm: { name: 'my-skill', description: GOOD_DESC },
    body: '# Title\n' + 'line\n'.repeat(520),
  });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'body-too-long' && i.severity === 'warning'));
});

test('propagates frontmatter parse errors', () => {
  const skill = makeSkill({ fm: {}, fmErrors: ['missing frontmatter: ...'] });
  assert.ok(lintSkill(skill).some((i) => i.rule === 'frontmatter' && i.severity === 'error'));
});

test('lintPaths scans a collection and finds duplicates', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-lint-'));
  try {
    const a = join(root, 'skill-a');
    const b = join(root, 'nested', 'skill-a');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    const content =
      '---\nname: skill-a\ndescription: Use when testing skill discovery across nested folders.\n---\nBody\n';
    writeFileSync(join(a, 'SKILL.md'), content);
    writeFileSync(join(b, 'SKILL.md'), content);
    const result = lintPaths([root]);
    assert.equal(result.summary.skills, 2);
    for (const report of result.reports) {
      assert.ok(report.issues.some((i) => i.rule === 'duplicate-name'));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lintPaths reports a missing skill for an empty directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-lint-'));
  try {
    const result = lintPaths([root]);
    assert.equal(result.summary.errors, 1);
    assert.equal(result.reports[0]?.issues[0]?.rule, 'no-skill');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lintPaths accepts a direct SKILL.md file path', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-lint-'));
  try {
    const dir = join(root, 'single');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: single\ndescription: Use when testing direct file path handling in lint.\n---\nBody\n',
    );
    const result = lintPaths([join(dir, 'SKILL.md')]);
    assert.equal(result.summary.errors, 0);
    assert.equal(result.summary.skills, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});