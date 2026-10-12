import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd?: string): CliResult {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function writeSkill(dir: string, name: string, description: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n\nDo the thing.\n`,
  );
}

test('--version prints the package version', () => {
  const r = runCli(['--version']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('--help lists all commands', () => {
  const r = runCli(['--help']);
  assert.equal(r.status, 0);
  for (const cmd of ['init', 'lint', 'test', 'pack']) {
    assert.match(r.stdout, new RegExp(cmd));
  }
});

test('unknown commands fail with exit code 2', () => {
  const r = runCli(['frobnicate']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command/);
});

test('init then lint passes end to end', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-cli-'));
  try {
    const init = runCli(['init', 'demo-skill', '--dir', root]);
    assert.equal(init.status, 0);
    const lint = runCli(['lint', join(root, 'demo-skill')]);
    assert.equal(lint.status, 0);
    assert.match(lint.stdout, /OK/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lint fails with exit code 1 on errors and supports --json', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-cli-'));
  try {
    const dir = join(root, 'broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: broken\n---\nBody\n');
    const r = runCli(['lint', dir]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /description-missing/);

    const rj = runCli(['lint', dir, '--json']);
    const data = JSON.parse(rj.stdout) as { ok: boolean; summary: { errors: number } };
    assert.equal(data.ok, false);
    assert.equal(data.summary.errors, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lint --strict fails on warnings only', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-cli-'));
  try {
    const dir = join(root, 'warn-skill');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: warn-skill\ndescription: Too short.\n---\nBody\n',
    );
    assert.equal(runCli(['lint', dir]).status, 0);
    assert.equal(runCli(['lint', dir, '--strict']).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('test ranks the closest skill and supports --json', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-cli-'));
  try {
    writeSkill(
      join(root, 'changelog-champ'),
      'changelog-champ',
      'Use when generating changelog entries from git history.',
    );
    writeSkill(join(root, 'image-editor'), 'image-editor', 'Use when editing images.');
    const r = runCli(['test', '--prompt', 'generate a changelog from git history', '--dir', root]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Best match: changelog-champ/);

    const rj = runCli([
      'test',
      '--prompt',
      'generate a changelog from git history',
      '--dir',
      root,
      '--json',
    ]);
    const data = JSON.parse(rj.stdout) as { best: string | null };
    assert.equal(data.best, 'changelog-champ');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pack produces an archive end to end', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-cli-'));
  try {
    assert.equal(runCli(['init', 'demo-skill', '--dir', root]).status, 0);
    const out = join(root, 'demo.tgz');
    const r = runCli(['pack', join(root, 'demo-skill'), '--out', out]);
    assert.equal(r.status, 0);
    assert.ok(existsSync(out));
    assert.match(r.stdout, /sha256 [0-9a-f]{64}/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});