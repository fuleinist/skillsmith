# skillsmith

> Toolkit for agent skills: scaffold, lint, test, and pack SKILL.md packages.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Agent skills are the breakout distribution format for coding agents. Authors
publish SKILL.md packages for Claude Code, Codex, Cursor, and other hosts.
skillsmith is the missing toolbox: it validates frontmatter, simulates which
skill a prompt activates, and builds distributable archives.

Zero runtime dependencies. Node 20 or newer.

## Commands

### `skillsmith init` — scaffold a skill

```bash
skillsmith init my-skill
skillsmith init my-skill --dir ./skills --description "Use when ..."
```

Creates `my-skill/SKILL.md` and `my-skill/README.md`. Fresh output passes
`skillsmith lint` with zero issues.

### `skillsmith lint` — validate SKILL.md files

```bash
skillsmith lint                  # current directory
skillsmith lint .claude/skills   # a collection
skillsmith lint path/SKILL.md    # a single file
skillsmith lint --json           # machine-readable output
skillsmith lint --strict         # fail on warnings too
```

Rules include: frontmatter parse errors, missing/format name, name and
directory mismatch, missing/short/long description, missing trigger guidance,
unknown keys, empty body, oversized body, leftover placeholders, and duplicate
skill names in a collection.

Exit codes: `0` clean, `1` findings, `2` usage error.

### `skillsmith test` — activation simulation

Which skill would a prompt trigger? Score = name token hits x3 + description
token hits x1.

```bash
skillsmith test --prompt "generate a changelog from git history" --dir ./skills
```

```
Activation simulation for: "generate a changelog from git history"

  1. changelog-champ  score 5  matched: changelog, git, history

Best match: changelog-champ (score 5)
```

Flags: `--dir`, `--top <n>`, `--min-score <n>`, `--json`.

### `skillsmith pack` — build a distributable archive

```bash
skillsmith pack ./skills/my-skill --out dist
```

Creates `dist/my-skill-0.1.0.tgz` and prints the sha256. The archive is
deterministic: the same input always produces the same bytes. `pack` refuses to
run when lint reports errors; pass `--force` to override.

## Install

skillsmith is not on npm yet. Build from source:

```bash
git clone https://github.com/fuleinist/skillsmith
cd skillsmith
npm install
npm run build
npm link   # optional: registers the `skillsmith` command
```

## Frontmatter subset

The parser supports common YAML constructs used in SKILL.md files:

- plain, double-quoted, and single-quoted scalars
- inline arrays (`[a, b]`) and block arrays (`- a`)
- literal (`|`) and folded (`>`) block scalars

## Development

```bash
npm run build   # compile with tsc
npm test        # build, then run the node:test suite
```

## Status

v0.1.0 — early preview. The spec lives in [SPEC.md](SPEC.md).

## License

MIT