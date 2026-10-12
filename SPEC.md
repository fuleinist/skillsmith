# SPEC — skillsmith v0.1.0

## Problem

Agent skills are a breakout distribution format. Authors publish SKILL.md
packages for Claude Code, Codex, Cursor, and other hosts. No standard tooling
checks the frontmatter, tests trigger quality, or builds a distributable
archive.

## Users

Skill authors who ship reusable SKILL.md packages.

## Scope (v0.1.0)

### 1. `skillsmith init <name>`

Scaffold a skill directory:

- Write `SKILL.md` with valid frontmatter (name, description, version).
- Write `README.md`.
- Validate the name: kebab-case, 64 characters or less.
- `--dir <parent>` selects the parent directory.
- `--description <text>` sets the description.
- `--force` overwrites an existing skill directory.

Fresh output must pass `skillsmith lint` with zero errors and zero warnings.

### 2. `skillsmith lint [path...]`

Validate SKILL.md files. A path may be a skill directory, a SKILL.md file, or a
collection directory that holds skills. The command finds nested skills up to
four levels deep.

Rules:

- `frontmatter` (error): the file must start with a parseable `---` block.
- `name-missing` (error): the required name field is absent.
- `name-format` (error): the name must be kebab-case.
- `name-too-long` (error): the name must have 64 characters or less.
- `name-dir-mismatch` (warning): the name should match the directory name.
- `description-missing` (error): the required description field is absent.
- `description-short` (warning): shorter than 40 characters.
- `description-long` (warning): longer than 1024 characters.
- `description-trigger` (info): no trigger guidance (such as "Use when ...").
- `unknown-key` (warning): unrecognized frontmatter key.
- `body-empty` (error): the body has no instructions.
- `body-too-long` (warning): more than 500 body lines.
- `placeholder` (warning): TODO/TBD/FIXME/XXX text remains.
- `duplicate-name` (warning): two scanned skills share a name.
- `no-skill` (error): no SKILL.md found under a given path.

Options:

- `--json` prints machine-readable output.
- `--strict` fails on warnings.

Exit codes: 0 = clean, 1 = findings, 2 = usage error.

### 3. `skillsmith test --prompt "<text>" [dir]`

Activation simulation. Rank skills by how likely they activate for a prompt.
Score = name token hits x3 + description token hits x1. Output shows the ranked
list, matched terms, and the best match.

Options:

- `--dir <collection>` selects the skills collection.
- `--top <n>` (default 5) limits the list.
- `--min-score <n>` (default 1) hides weak matches.
- `--json` prints machine-readable output.

### 4. `skillsmith pack [path] [--out <file-or-dir>]`

Lint-gated packaging. The command refuses to pack on lint errors unless
`--force`. Output is a deterministic `.tgz` (ustar) archive. Files are stored
under a `<name>/` prefix. The command prints the sha256 of the archive.

## Acceptance criteria

- AC1: fresh `init` output passes `lint` with zero issues.
- AC2: `lint` reports every rule above with correct severities.
- AC3: exit codes: 0 clean; 1 findings; 1 warnings under `--strict`; 2 usage.
- AC4: `test` ranks the closest skill first for a clear prompt.
- AC5: `pack` is byte-identical across runs for the same input.
- AC6: zero runtime dependencies; Node 20 or newer; works on Windows and POSIX.
- AC7: `npm test` runs a node:test suite; all tests pass.
- AC8: README and MIT license present.

## Non-goals

- No registry, no network calls, no host-specific installers.
- No full YAML support; the parser handles a documented subset.

## Verification

- `npm run build` passes with no errors.
- `npm test` passes.
- Manual smoke test: init -> lint -> test -> pack -> extract.

## Build log

- Cycle 1 (2026-10-13): scaffold, spec, frontmatter parser + tests. Commit aad8a7b.
- Cycle 2 (2026-10-13): skill loader, lint engine, lint command + tests. Commit c42e83d.
- Cycle 3 (2026-10-13): activation simulator, tar packer, init/pack/test commands, CLI. Commit cc86b8a.
- Cycle 4 (2026-10-13): CLI end-to-end tests, README, example skill, final verification. 48 tests green; tar extraction smoke test passed.