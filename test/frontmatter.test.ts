import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../src/lib/frontmatter.js';

test('parses simple key-value frontmatter', () => {
  const out = parseFrontmatter(
    '---\nname: my-skill\ndescription: Does things.\n---\nBody here\n',
  );
  assert.equal(out.errors.length, 0);
  assert.equal(out.data.name, 'my-skill');
  assert.equal(out.data.description, 'Does things.');
  assert.equal(out.body.trim(), 'Body here');
});

test('strips double-quoted strings and escapes', () => {
  const out = parseFrontmatter(
    '---\nname: x\ndescription: "He said \\"hi\\": ok"\n---\nBody\n',
  );
  assert.equal(out.data.description, 'He said "hi": ok');
});

test('parses single-quoted strings', () => {
  const out = parseFrontmatter(
    "---\nname: x\ndescription: 'It''s fine'\n---\nB\n",
  );
  assert.equal(out.data.description, "It's fine");
});

test('parses inline arrays', () => {
  const out = parseFrontmatter(
    '---\nname: x\ndescription: y\nallowed-tools: [Read, Write, Glob]\n---\nB\n',
  );
  assert.deepEqual(out.data['allowed-tools'], ['Read', 'Write', 'Glob']);
});

test('parses block arrays', () => {
  const out = parseFrontmatter(
    '---\nname: x\ndescription: y\nkeywords:\n  - alpha\n  - beta\n---\nB\n',
  );
  assert.deepEqual(out.data.keywords, ['alpha', 'beta']);
});

test('parses literal block scalars', () => {
  const out = parseFrontmatter(
    '---\nname: x\ndescription: y\nnotes: |\n  line one\n  line two\n---\nB\n',
  );
  assert.equal(out.data.notes, 'line one\nline two\n');
});

test('parses folded block scalars', () => {
  const out = parseFrontmatter(
    '---\nname: x\ndescription: y\nnotes: >\n  line one\n  line two\n\n  para two\n---\nB\n',
  );
  assert.equal(out.data.notes, 'line one line two\npara two\n');
});

test('reports missing frontmatter', () => {
  const out = parseFrontmatter('# Just a doc\n');
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0] ?? '', /missing frontmatter/);
});

test('reports unterminated frontmatter', () => {
  const out = parseFrontmatter('---\nname: x\n');
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0] ?? '', /unterminated/);
});

test('handles CRLF and BOM', () => {
  const out = parseFrontmatter(
    '\uFEFF---\r\nname: x\r\ndescription: y\r\n---\r\nBody\r\n',
  );
  assert.equal(out.errors.length, 0);
  assert.equal(out.data.name, 'x');
  assert.equal(out.body.trim(), 'Body');
});

test('strips plain scalar comments', () => {
  const out = parseFrontmatter('---\nname: x # the name\ndescription: y\n---\nB\n');
  assert.equal(out.data.name, 'x');
});

test('keeps hash inside a value when not preceded by a space', () => {
  const out = parseFrontmatter('---\nname: x\ndescription: a#b c\n---\nB\n');
  assert.equal(out.data.description, 'a#b c');
});

test('reports invalid lines', () => {
  const out = parseFrontmatter('---\nname: x\nnot a yaml line\n---\nB\n');
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0] ?? '', /invalid line/);
});