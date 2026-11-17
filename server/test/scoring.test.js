import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRun, initialsOk, POINTS, dayKey } from '../../src/scoring.js';

const kills = (k = {}) => ({ r3: 0, r2: 0, r1: 0, mine: 0, skiff: 0, layer: 0, hunter: 0, ...k });
const scoreOf = (k) => Object.keys(POINTS).reduce((s, n) => s + k[n] * POINTS[n], 0);
const run = (k, wave = 1) => ({ score: scoreOf(k), wave, kills: k });

test('a cleared first wave in 30 s passes', () => {
  const k = kills({ r3: 4, r2: 8, r1: 16, skiff: 1 });
  assert.equal(checkRun(run(k, 2), 30_000), null);
});

test('score must equal the kills', () => {
  const k = kills({ r3: 1 });
  assert.equal(checkRun({ score: 30, wave: 1, kills: k }, 30_000), 'score does not match kills');
});

test('rejects bad shapes', () => {
  assert.equal(checkRun({ score: -20, wave: 1, kills: kills() }, 30_000), 'bad numbers');
  assert.equal(checkRun({ score: 0, wave: 1, kills: { ...kills(), extra: 1 } }, 30_000), 'bad kills');
  assert.equal(checkRun({ score: 0, wave: 1, kills: { r3: 1.5 } }, 30_000), 'bad kills');
  assert.equal(checkRun({ score: 0, wave: 1 }, 30_000), 'bad kills');
});

test('more rocks than the waves spawned', () => {
  assert.equal(checkRun(run(kills({ r3: 5 }), 1), 60_000), 'more rocks than spawned');
  assert.equal(checkRun(run(kills({ r1: 17 }), 1), 60_000), 'more rocks than spawned');
});

test('waves need time', () => {
  assert.equal(checkRun(run(kills(), 20), 10_000), 'waves too fast');
});

test('aliens and the gun are rate limited', () => {
  assert.equal(checkRun(run(kills({ hunter: 20 }), 5), 30_000), 'too many aliens');
  assert.equal(checkRun(run(kills({ r1: 1700 }), 100), 250_000), 'kills faster than the gun fires');
});

test('expired sessions', () => {
  assert.equal(checkRun(run(kills()), 7 * 3600 * 1000), 'session expired');
});

test('initials', () => {
  assert.ok(initialsOk('ABC'));
  assert.ok(!initialsOk('AB'));
  assert.ok(!initialsOk('abc'));
  assert.ok(!initialsOk('KKK'));
  assert.ok(!initialsOk(123));
});

test('day key is UTC', () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 17, 23, 59)), '2026-11-17');
  assert.equal(dayKey(Date.UTC(2026, 10, 18, 0, 1)), '2026-11-18');
});
