---
name: changelog-champ
description: Use when generating changelog entries from git history, release notes, or commit ranges.
version: 0.1.0
---

# Changelog Champ

## When to use

Use this skill when a user asks for a changelog, release notes, or a summary
of commits between two references.

## Instructions

1. Read the git history for the requested range.
2. Group changes as Added, Changed, Fixed, and Removed.
3. Write short entries in the imperative mood.
4. Link issue numbers when they appear in commit messages.

## Examples

Input: "summarize v1.2.0..v1.3.0". Output: a grouped changelog section with
one line per change.