/**
 * Minimal YAML-subset parser for SKILL.md frontmatter.
 *
 * Supported constructs:
 *   key: value            plain scalars (inline " # comment" is stripped)
 *   key: "quoted"         double-quoted strings (JSON escapes)
 *   key: 'quoted'         single-quoted strings ('' escapes a quote)
 *   key: [a, b, c]        inline arrays
 *   key:
 *     - item              block arrays
 *   key: |                literal block scalars (with - and + chomping)
 *   key: >                folded block scalars
 *
 * Everything else is reported as a parse error.
 */

export interface ParsedFrontmatter {
  /** Parsed key-value pairs. Values are strings or string arrays. */
  data: Record<string, string | string[]>;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** Hard parse errors. Empty when parsing succeeded. */
  errors: string[];
}

const DELIMITER = '---';

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const errors: string[] = [];
  const data: Record<string, string | string[]> = {};

  const src = text.replace(/^\uFEFF/, '');
  const lines = src.split(/\r?\n/);

  // Find the opening delimiter. It must be the first non-empty line.
  let start = -1;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = (lines[i] ?? '').trim();
    if (line === DELIMITER) {
      start = i;
      break;
    }
    if (line !== '') break;
  }
  if (start === -1) {
    return {
      data,
      body: src,
      errors: ['missing frontmatter: SKILL.md must start with a --- block'],
    };
  }

  // Find the closing delimiter.
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === DELIMITER) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return {
      data,
      body: '',
      errors: ['unterminated frontmatter: closing --- not found'],
    };
  }

  const fmLines = lines.slice(start + 1, end);
  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^\n+/, '');

  let i = 0;
  while (i < fmLines.length) {
    const raw = fmLines[i] ?? '';
    i++;
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      errors.push(`invalid line in frontmatter: ${line}`);
      continue;
    }
    const key = m[1] ?? '';
    const rest = (m[2] ?? '').trim();

    if (rest === '') {
      // Block array or empty value.
      const items: string[] = [];
      while (i < fmLines.length) {
        const next = fmLines[i] ?? '';
        const itemMatch = /^\s+-\s+(.*)$/.exec(next);
        if (!itemMatch) break;
        items.push(stripQuotesAndComment((itemMatch[1] ?? '').trim()));
        i++;
      }
      data[key] = items.length > 0 ? items : '';
      continue;
    }

    if (/^[|>][+-]?$/.test(rest)) {
      // Block scalar.
      const style = rest[0] === '|' ? 'literal' : 'folded';
      const chomp = rest.length > 1 ? rest[1] : '';
      const collected: string[] = [];
      while (i < fmLines.length) {
        const next = fmLines[i] ?? '';
        if (next.trim() === '') {
          collected.push('');
          i++;
          continue;
        }
        if (!/^\s/.test(next)) break;
        collected.push(next);
        i++;
      }
      while (collected.length > 0 && collected[collected.length - 1] === '') {
        collected.pop();
      }
      data[key] = renderBlockScalar(collected, style, chomp);
      continue;
    }

    if (rest.startsWith('[')) {
      if (!rest.endsWith(']')) {
        errors.push(`unterminated inline array for "${key}"`);
        data[key] = rest;
        continue;
      }
      const inner = rest.slice(1, -1).trim();
      const items =
        inner === ''
          ? []
          : inner.split(',').map((s) => stripQuotesAndComment(s.trim()));
      data[key] = items;
      continue;
    }

    data[key] = stripQuotesAndComment(rest);
  }

  return { data, body, errors };
}

function findClosingDoubleQuote(value: string): number {
  for (let j = 1; j < value.length; j++) {
    const ch = value[j];
    if (ch === '\\') {
      j++;
      continue;
    }
    if (ch === '"') return j;
  }
  return -1;
}

function findClosingSingleQuote(value: string): number {
  for (let j = 1; j < value.length; j++) {
    if (value[j] === "'") {
      if (value[j + 1] === "'") {
        j++;
        continue;
      }
      return j;
    }
  }
  return -1;
}

function stripQuotesAndComment(value: string): string {
  const v = value.trim();
  if (v.startsWith('"')) {
    const end = findClosingDoubleQuote(v);
    if (end === -1) return v;
    const raw = v.slice(0, end + 1);
    try {
      return JSON.parse(raw) as string;
    } catch {
      return v.slice(1, end);
    }
  }
  if (v.startsWith("'")) {
    const end = findClosingSingleQuote(v);
    if (end === -1) return v;
    return v.slice(1, end).replace(/''/g, "'");
  }
  return v.replace(/\s+#.*$/, '').trim();
}

function renderBlockScalar(
  lines: string[],
  style: 'literal' | 'folded',
  chomp: string,
): string {
  // Dedent by the smallest indentation of non-empty lines.
  let indent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = /^\s*/.exec(line);
    indent = Math.min(indent, m ? m[0].length : 0);
  }
  if (indent === Infinity) indent = 0;
  const dedented = lines.map((l) => (l.trim() === '' ? '' : l.slice(indent)));

  let out: string;
  if (style === 'literal') {
    out = dedented.join('\n');
  } else {
    // Folded: non-empty lines join with a space; blank lines become newlines.
    const parts: string[] = [];
    let pendingSpace = false;
    for (const l of dedented) {
      if (l === '') {
        parts.push('\n');
        pendingSpace = false;
        continue;
      }
      if (parts.length > 0 && pendingSpace) parts.push(' ');
      parts.push(l);
      pendingSpace = true;
    }
    out = parts.join('');
  }

  if (chomp === '-') return out.replace(/\n+$/, '');
  if (chomp === '+') return out.endsWith('\n') || out === '' ? out : out + '\n';
  return out.replace(/\n*$/, '') + '\n';
}