/** Tiny command-line parser. Zero dependencies. */

export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | boolean>;
}

/**
 * Parse argv. Flags listed in valueFlags consume the next token as their
 * value; all other `--flag` tokens are booleans. `--flag=value` always works.
 */
export function parseArgs(argv: string[], valueFlags: string[] = []): ParsedArgs {
  const takesValue = new Set(valueFlags);
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
        continue;
      }
      const name = a.slice(2);
      const next = argv[i + 1];
      if (takesValue.has(name) && next !== undefined && !next.startsWith('-')) {
        flags.set(name, next);
        i++;
      } else {
        flags.set(name, true);
      }
      continue;
    }
    if (/^-[A-Za-z]$/.test(a)) {
      flags.set(a.slice(1), true);
      continue;
    }
    positionals.push(a);
  }
  return { positionals, flags };
}

export function flagString(args: ParsedArgs, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = args.flags.get(n);
    if (typeof v === 'string') return v;
  }
  return undefined;
}

export function flagBool(args: ParsedArgs, ...names: string[]): boolean {
  for (const n of names) {
    const v = args.flags.get(n);
    if (v === true) return true;
    if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  }
  return false;
}