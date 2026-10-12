import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPack } from '../src/commands/pack.js';
import { runInit } from '../src/commands/init.js';

interface TarItem {
  path: string;
  size: number;
  data: Buffer;
}

/** Minimal tar reader for verification in tests. */
function readTarGz(file: string): TarItem[] {
  const tar = gunzipSync(readFileSync(file));
  const out: TarItem[] = [];
  let off = 0;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const size = Number.parseInt(
      header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0',
      8,
    );
    off += 512;
    const data = Buffer.from(tar.subarray(off, off + size));
    out.push({ path: prefix ? `${prefix}/${name}` : name, size, data });
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

function scaffold(root: string): string {
  const code = runInit(['demo-skill', '--dir', root]);
  assert.equal(code, 0);
  const dir = join(root, 'demo-skill');
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'hello.sh'), 'echo hello\n');
  return dir;
}

test('pack creates a deterministic tgz containing the skill files', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-pack-'));
  try {
    const dir = scaffold(root);
    const out1 = join(root, 'archive-one.tgz');
    const out2 = join(root, 'archive-two.tgz');
    assert.equal(runPack([dir, '--out', out1]), 0);
    assert.equal(runPack([dir, '--out', out2]), 0);

    assert.ok(existsSync(out1));
    assert.deepEqual(readFileSync(out1), readFileSync(out2)); // byte-identical

    const items = readTarGz(out1);
    const paths = items.map((i) => i.path).sort();
    assert.deepEqual(paths, [
      'demo-skill/README.md',
      'demo-skill/SKILL.md',
      'demo-skill/scripts/hello.sh',
    ]);

    const skillMd = items.find((i) => i.path === 'demo-skill/SKILL.md');
    assert.ok(skillMd);
    assert.match(skillMd.data.toString('utf8'), /name: demo-skill/);

    const script = items.find((i) => i.path === 'demo-skill/scripts/hello.sh');
    assert.ok(script);
    assert.equal(script.data.toString('utf8'), 'echo hello\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pack refuses lint errors unless --force', () => {
  const root = mkdtempSync(join(tmpdir(), 'skillsmith-pack-'));
  try {
    const dir = join(root, 'broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: broken\n---\nBody\n');
    const out = join(root, 'broken.tgz');
    assert.equal(runPack([dir, '--out', out]), 1);
    assert.ok(!existsSync(out));
    assert.equal(runPack([dir, '--out', out, '--force']), 0);
    assert.ok(existsSync(out));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});