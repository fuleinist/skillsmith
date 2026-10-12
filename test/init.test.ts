import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init.js';
import { lintSkill } from '../src/lib/lint.js';
import { loadSkill } from '../src/lib/skill.js';

test('init scaffolds a skill that passes lint cleanly', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-init-'));
  try {
    const code = runInit(['demo-skill', '--dir', root]);
    assert.equal(code, 0);
    const dir = join(root, 'demo-skill');
    assert.ok(existsSync(join(dir, 'SKILL.md')));
    assert.ok(existsSync(join(dir, 'README.md')));
    const skill = loadSkill(dir);
    assert.ok(skill);
    assert.equal(skill.frontmatter.name, 'demo-skill');
    assert.deepEqual(lintSkill(skill), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('init rejects invalid names', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-init-'));
  try {
    assert.equal(runInit(['Bad Name', '--dir', root]), 2);
    assert.equal(runInit(['UPPER', '--dir', root]), 2);
    assert.equal(runInit([]), 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('init refuses to overwrite a non-empty directory without --force', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-init-'));
  try {
    assert.equal(runInit(['demo', '--dir', root]), 0);
    assert.equal(runInit(['demo', '--dir', root]), 1);
    assert.equal(runInit(['demo', '--dir', root, '--force']), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('init uses a custom description', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-init-'));
  try {
    const code = runInit([
      'demo',
      '--dir',
      root,
      '--description',
      'Use when shipping custom descriptions for tests.',
    ]);
    assert.equal(code, 0);
    const text = readFileSync(join(root, 'demo', 'SKILL.md'), 'utf8');
    assert.match(text, /Use when shipping custom descriptions for tests\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});