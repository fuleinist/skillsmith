#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runInit } from './commands/init.js';
import { runLint } from './commands/lint.js';
import { runPack } from './commands/pack.js';
import { runTest } from './commands/test.js';

function version(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const HELP = `skillsmith v${version()} - toolkit for agent skills

Usage: skillsmith <command> [options]

Commands:
  init <name>       Scaffold a new skill (SKILL.md + README.md)
  lint [path...]    Validate SKILL.md files
  test              Simulate which skill activates for a prompt
  pack [path]       Pack a skill into a distributable .tgz archive

Options:
  -h, --help        Show this help
  -v, --version     Show version

Examples:
  skillsmith init my-skill
  skillsmith lint .claude/skills
  skillsmith test --prompt "add tests for the parser" --dir .claude/skills
  skillsmith pack .claude/skills/my-skill --out dist

Run "skillsmith <command> --help" for command details.`;

export function main(argv: string[]): number {
  const cmd = argv[0] ?? '';
  const rest = argv.slice(1);

  if (cmd === '' || cmd === '-h' || cmd === '--help') {
    console.log(HELP);
    return 0;
  }
  if (cmd === '-v' || cmd === '--version') {
    console.log(version());
    return 0;
  }

  switch (cmd) {
    case 'init':
      return runInit(rest);
    case 'lint':
      return runLint(rest);
    case 'test':
      return runTest(rest);
    case 'pack':
      return runPack(rest);
    default:
      console.error(`error: unknown command "${cmd}"`);
      console.error('');
      console.error(HELP);
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));