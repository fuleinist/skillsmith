import { flagBool, parseArgs } from '../lib/args.js';
import { lintPaths } from '../lib/lint.js';

const HELP = `Usage: skillsmith lint [path...] [options]

Validate SKILL.md files.

Arguments:
  path...            Skill directory, SKILL.md file, or collection directory.
                     Default: current directory.

Options:
  --json             Print machine-readable JSON output.
  --strict           Fail on warnings as well as errors.
  -h, --help         Show this help.

Exit codes: 0 clean, 1 findings, 2 usage error.`;

export function runLint(argv: string[]): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const args = parseArgs(argv);
  const json = flagBool(args, 'json');
  const strict = flagBool(args, 'strict');
  const paths = args.positionals.length > 0 ? args.positionals : ['.'];

  const result = lintPaths(paths);
  const { errors, warnings, infos, skills } = result.summary;
  const ok = errors === 0 && (!strict || warnings === 0);

  if (json) {
    console.log(JSON.stringify({ ok, summary: result.summary, reports: result.reports }, null, 2));
  } else {
    const sevOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    for (const report of result.reports) {
      const hasError = report.issues.some((i) => i.severity === 'error');
      const hasWarning = report.issues.some((i) => i.severity === 'warning');
      const label = hasError ? 'FAIL' : hasWarning ? 'WARN' : 'OK';
      console.log(`${label}  ${report.skillFile}`);
      const sorted = [...report.issues].sort(
        (a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9),
      );
      for (const issue of sorted) {
        console.log(`  [${issue.severity}] ${issue.rule}: ${issue.message}`);
      }
    }
    console.log('');
    console.log(
      `${skills} skill(s) scanned - ${errors} error(s), ${warnings} warning(s), ${infos} info(s)`,
    );
  }

  return ok ? 0 : 1;
}