import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSkills, scorePrompt, tokenize } from '../src/lib/activation.js';

test('tokenize lowercases, drops stopwords and short tokens', () => {
  assert.deepEqual(tokenize('Generate a CHANGELOG from git history!'), [
    'generate',
    'changelog',
    'git',
    'history',
  ]);
  assert.deepEqual(tokenize('a I x'), []);
});

test('scores name hits at 3 and description hits at 1', () => {
  const r = scorePrompt('generate a changelog from git history', {
    name: 'changelog-champ',
    description: 'Use when generating changelog entries from git history.',
  });
  assert.equal(r.score, 5);
  assert.deepEqual(r.matched, ['changelog', 'git', 'history']);
});

test('ranks name matches above description matches', () => {
  const hits = rankSkills('npm help', [
    { dir: '/a', name: 'npm-helper', description: 'nope' },
    { dir: '/b', name: 'zeta', description: 'Use when you need npm installs.' },
  ]);
  assert.equal(hits[0]?.name, 'npm-helper');
  assert.equal(hits[0]?.score, 3);
  assert.equal(hits[1]?.score, 1);
});

test('filters by min score and top limit', () => {
  const skills = [
    { dir: '/a', name: 'alpha', description: 'alpha beta' },
    { dir: '/b', name: 'beta', description: 'beta gamma' },
    { dir: '/c', name: 'gamma', description: 'gamma delta' },
  ];
  const hits = rankSkills('beta gamma', skills, { minScore: 2, top: 1 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.name, 'beta');
});

test('returns no hits when nothing matches', () => {
  const hits = rankSkills('kubernetes clusters', [
    { dir: '/a', name: 'sewing', description: 'Use when sewing clothes.' },
  ]);
  assert.deepEqual(hits, []);
});