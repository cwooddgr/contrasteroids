import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDungeonRun, POINTS } from '../src/games/dungeon.js';

// A run whose score adds up from its kills.
const R = (k, level = 1) => {
  const kills = { monster: 0, chest: 0, entries: 0, ...k };
  return { score: kills.monster * POINTS.monster + kills.chest * POINTS.chest, wave: level, kills };
};

test('a cleared first level in 60 s passes, and the bot run (3300 at level 1) does too', () => {
  assert.equal(checkDungeonRun(R({ monster: 13, chest: 4, entries: 4 }, 2), 60_000), null);
  assert.equal(checkDungeonRun(R({ monster: 13, chest: 4, entries: 5 }, 2), 55_000), null);
});

test('score must equal the kills', () => {
  assert.equal(checkDungeonRun({ score: 600, wave: 1, kills: { monster: 1, chest: 0, entries: 1 } }, 30_000),
    'score does not match kills');
});

test('rejects bad shapes', () => {
  assert.equal(checkDungeonRun({ score: 0, wave: 0, kills: { monster: 0, chest: 0, entries: 0 } }, 1000), 'bad numbers');
  assert.equal(checkDungeonRun({ score: 0, wave: 1, kills: { monster: 0, chest: 0 } }, 1000), 'bad kills');
  assert.equal(checkDungeonRun({ score: 0, wave: 1, kills: { monster: 0, chest: 0, entries: 0, r1: 0 } }, 1000), 'bad kills');
  assert.equal(checkDungeonRun({ score: 100, wave: 1, kills: { monster: 1.5, chest: 0, entries: 1 } }, 1000), 'bad kills');
});

test('levels need their treasures, treasures need visits', () => {
  assert.equal(checkDungeonRun(R({ chest: 3, entries: 3 }, 2), 60_000), 'level without the treasures');
  assert.equal(checkDungeonRun(R({ chest: 2, entries: 1 }), 60_000), 'more chests than visits');
  assert.equal(checkDungeonRun(R({ monster: 9, entries: 2 }), 60_000), 'more monsters than spawned');
});

test('rates are limited by time', () => {
  assert.equal(checkDungeonRun(R({ entries: 50 }), 10_000), 'visits too fast');
  assert.equal(checkDungeonRun(R({ chest: 10, entries: 10 }), 15_000), 'treasures too fast');
  assert.equal(checkDungeonRun(R({ monster: 60, entries: 15 }), 20_000), 'kills faster than the bow fires');
});
