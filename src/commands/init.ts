import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { flagBool, flagString, parseArgs } from '../lib/args.js';

const HELP = `Usage: skillsmith init <name> [options]

Scaffold a new skill directory with SKILL.md and README.md.

Options:
  --dir <parent>         Parent directory (default: current directory).
  --description <text>   Custom description for the SKILL.md frontmatter.
  --force               Overwrite an existing directory.
  -h, --help             Show this help.`;

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function runInit(argv: string[]): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const args = parseArgs(argv, ['dir', 'description']);
  const name = args.positionals[0];
  if (!name) {
    console.error('usage: skillsmith init <name> [--dir <parent>] [--description <text>] [--force]');
    return 2;
  }
  if (!NAME_RE.test(name) || name.length > 64) {
    console.error(
      `error: "${name}" is not a valid skill name; use kebab-case (a-z, 0-9, dashes), max 64 chars`,
    );
    return 2;
  }

  const parent = resolve(flagString(args, 'dir') ?? '.');
  const target = join(parent, name);
  const force = flagBool(args, 'force');

  if (existsSync(target)) {
    let empty = false;
    try {
      empty = readdirSync(target).length === 0;
    } catch {
      empty = false;
    }
    if (!empty && !force) {
      console.error(`error: ${target} already exists and is not empty; use --force to overwrite`);
      return 1;
    }
  }

  const description =
    flagString(args, 'description') ??
    `Use when <replace this line>: describe what ${name} does and when it should trigger.`;

  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'SKILL.md'), skillTemplate(name, description));
  writeFileSync(join(target, 'README.md'), readmeTemplate(name, description));

  console.log(`Created ${join(target, 'SKILL.md')}`);
  console.log(`Created ${join(target, 'README.md')}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Edit the files and describe the skill.`);
  console.log(`  2. Run: skillsmith lint ${target}`);
  console.log(`  3. Run: skillsmith pack ${target}`);
  return 0;
}

function titleCase(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function skillTemplate(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
version: 0.1.0
---

# ${titleCase(name)}

## When to use

<Describe the situations that should activate this skill.>

## Instructions

1. <First step.>
2. <Second step.>

## Examples

<Show a short example input and the expected result.>
`;
}

function readmeTemplate(name: string, description: string): string {
  return `# ${name}

${description}

Scaffolded with [skillsmith](https://github.com/fuleinist/skillsmith).
`;
}