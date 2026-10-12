/** Heuristic activation scoring: which skill would a prompt trigger? */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'has', 'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'so', 'such', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'up',
  'us', 'use', 'used', 'using', 'was', 'we', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'you', 'your', 'skill', 'skills', 'agent',
  'agents',
]);

/** Tokenize text into lowercase terms, dropping stopwords and short tokens. */
export function tokenize(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

export interface ActivationHit {
  dir: string;
  name: string;
  score: number;
  matched: string[];
}

export interface RankOptions {
  minScore?: number;
  top?: number;
}

/** Score one skill against a prompt. Name hits weigh 3, description hits weigh 1. */
export function scorePrompt(
  prompt: string,
  skill: { name: string; description: string },
): { score: number; matched: string[] } {
  const promptTokens = tokenize(prompt);
  const nameTokens = new Set(tokenize(skill.name));
  const descTokens = new Set(tokenize(skill.description));
  let score = 0;
  const matched: string[] = [];
  for (const tok of promptTokens) {
    if (nameTokens.has(tok)) {
      score += 3;
      matched.push(tok);
    } else if (descTokens.has(tok)) {
      score += 1;
      matched.push(tok);
    }
  }
  return { score, matched };
}

/** Rank skills for a prompt. */
export function rankSkills(
  prompt: string,
  skills: Array<{ dir: string; name: string; description: string }>,
  opts: RankOptions = {},
): ActivationHit[] {
  const minScore = opts.minScore ?? 1;
  const top = opts.top ?? 5;
  const hits = skills.map((s) => {
    const r = scorePrompt(prompt, s);
    return { dir: s.dir, name: s.name, score: r.score, matched: r.matched };
  });
  return hits
    .filter((h) => h.score >= minScore)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, top);
}