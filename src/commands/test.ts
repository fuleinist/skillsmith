import { basename, resolve } from 'node:path';
import { flagBool, flagString, parseArgs } from '../lib/args.js';
import { rankSkills } from '../lib/activation.js';
import { findSkillDirs, loadSkill } from '../lib/skill.js';

const HELP = `Usage: skillsmith test --prompt "<text>" [dir] [options]

Activation simulation: rank skills by which one a prompt would trigger.

Options:
  --prompt <text>    The prompt to test (required).
  --dir <path>       Skills collection to search (default: current directory).
  --top <n>          Maximum results to show (default: 5).
  --min-score <n>    Minimum score to report (default: 1).
  --json             Print machine-readable JSON output.
  -h, --help         Show this help.`;

export function runTest(argv: string[]): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const args = parseArgs(argv, ['prompt', 'dir', 'top', 'min-score']);
  const prompt = flagString(args, 'prompt');
  if (!prompt) {
    console.error('usage: skillsmith test --prompt "<text>" [--dir <path>] [--top 5] [--min-score 1]');
    return 2;
  }
  const dir = flagString(args, 'dir') ?? args.positionals[0] ?? '.';
  const topRaw = Number.parseInt(flagString(args, 'top') ?? '5', 10);
  const top = Number.isNaN(topRaw) ? 5 : topRaw;
  const minScoreRaw = Number.parseInt(flagString(args, 'min-score') ?? '1', 10);
  const minScore = Number.isNaN(minScoreRaw) ? 1 : minScoreRaw;
  const json = flagBool(args, 'json');

  const root = resolve(dir);
  const skills: Array<{ dir: string; name: string; description: string }> = [];
  for (const d of findSkillDirs(root)) {
    const s = loadSkill(d);
    if (!s) continue;
    skills.push({
      dir: s.dir,
      name: typeof s.frontmatter.name === 'string' ? s.frontmatter.name : basename(s.dir),
      description:
        typeof s.frontmatter.description === 'string' ? s.frontmatter.description : '',
    });
  }

  const hits = rankSkills(prompt, skills, { minScore, top });

  if (json) {
    console.log(JSON.stringify({ prompt, results: hits, best: hits[0]?.name ?? null }, null, 2));
  } else if (hits.length === 0) {
    console.log(`No skill scored ${minScore} or more for: "${prompt}"`);
    console.log(`${skills.length} skill(s) scanned under ${root}`);
  } else {
    console.log(`Activation simulation for: "${prompt}"`);
    console.log('');
    hits.forEach((h, idx) => {
      console.log(`  ${idx + 1}. ${h.name}  score ${h.score}  matched: ${h.matched.join(', ')}`);
    });
    console.log('');
    console.log(`Best match: ${hits[0]?.name} (score ${hits[0]?.score})`);
  }
  return 0;
}