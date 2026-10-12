import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { flagBool, flagString, parseArgs } from '../lib/args.js';
import { lintSkill } from '../lib/lint.js';
import { loadSkill } from '../lib/skill.js';
import { createTarGz } from '../lib/tar.js';
import { formatBytes, sha256, walkFiles } from '../lib/util.js';

const HELP = `Usage: skillsmith pack [path] [options]

Pack a skill into a distributable .tgz archive.

Arguments:
  path               Skill directory or SKILL.md file (default: current directory).

Options:
  --out <file|dir>   Output file or existing directory
                     (default: <name>-<version>.tgz in the current directory).
  --force            Pack even when lint reports errors.
  --json             Print machine-readable JSON output.
  -h, --help         Show this help.`;

export function runPack(argv: string[]): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const args = parseArgs(argv, ['out']);
  const json = flagBool(args, 'json');
  const force = flagBool(args, 'force');
  const input = resolve(args.positionals[0] ?? '.');

  let dir = input;
  try {
    if (statSync(input).isFile() && basename(input).toLowerCase() === 'skill.md') {
      dir = dirname(input);
    }
  } catch {
    // Keep the input as-is; loadSkill reports the problem.
  }

  const skill = loadSkill(dir);
  if (!skill) {
    console.error(`error: no SKILL.md found in ${dir}`);
    return 1;
  }

  const lintErrors = lintSkill(skill).filter((i) => i.severity === 'error');
  if (lintErrors.length > 0 && !force) {
    console.error(
      `error: ${skill.skillFile} has ${lintErrors.length} lint error(s); fix them or pass --force`,
    );
    for (const i of lintErrors) console.error(`  [error] ${i.rule}: ${i.message}`);
    return 1;
  }

  const name =
    typeof skill.frontmatter.name === 'string' && skill.frontmatter.name !== ''
      ? skill.frontmatter.name
      : basename(dir);
  const version =
    typeof skill.frontmatter.version === 'string' && skill.frontmatter.version !== ''
      ? skill.frontmatter.version
      : '0.0.0';

  const files = walkFiles(dir, ['.git', 'node_modules', 'dist']).filter(
    (f) => !f.rel.endsWith('.tgz'),
  );
  if (files.length === 0) {
    console.error('error: no files to pack');
    return 1;
  }

  const entries = files.map((f) => ({ path: `${name}/${f.rel}`, data: readFileSync(f.abs) }));
  const tgz = createTarGz(entries);
  const hash = sha256(tgz);

  const outFlag = flagString(args, 'out');
  let outPath: string;
  if (outFlag) {
    outPath = resolve(outFlag);
    try {
      if (statSync(outPath).isDirectory()) outPath = join(outPath, `${name}-${version}.tgz`);
    } catch {
      // New path: use it as the output file.
    }
  } else {
    outPath = resolve(`${name}-${version}.tgz`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, tgz);

  if (json) {
    console.log(
      JSON.stringify(
        { name, version, out: outPath, files: files.length, bytes: tgz.length, sha256: hash },
        null,
        2,
      ),
    );
  } else {
    console.log(`Packed ${name} v${version} -> ${outPath}`);
    console.log(`${files.length} file(s), ${formatBytes(tgz.length)}, sha256 ${hash}`);
  }
  return 0;
}