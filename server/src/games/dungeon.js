// Scoring rules for Dungeon (~/projects/dungeon, a Godot game), checked by the
// same Worker as Contrasteroids under mode "dungeon". No imports.
//
// Dungeon's points live in its game/scripts/tuning.gd (skeleton_kill_score,
// chest_score, used for every monster type) and the client in
// game/scripts/scores.gd sends { score, wave: level, kills: { monster, chest,
// entries } }. Change points or the limits below together with the game, or
// real games get rejected.

export const MODE = 'dungeon';
export const POINTS = { monster: 100, chest: 500 };
export const KINDS = ['monster', 'chest', 'entries']; // entries: room visits started

// Physical limits from the game, kept loose so a genuine score never fails.
export const ROOMS_PER_LEVEL = 4; // each level needs every room's treasure
export const MAX_MONSTERS_PER_ROOM = 4; // a room respawns its monsters on each visit
export const MIN_KILL_SECS = 0.5; // 2+ arrow hits per kill, 0.3 s arrow cooldown
export const MIN_VISIT_SECS = 1.0; // a fade in and out alone take this long
export const MIN_CHEST_SECS = 3.0; // in through a door, to the chest, and back out

// Returns null if the run is plausible, otherwise a short reason.
export function checkDungeonRun({ score, wave, kills }, elapsedMs) {
  const int = (n) => Number.isSafeInteger(n) && n >= 0;
  if (!int(score) || !int(wave) || wave < 1 || wave > 1000) return 'bad numbers';
  if (!kills || typeof kills !== 'object') return 'bad kills';
  for (const k of KINDS) if (!int(kills[k])) return 'bad kills';
  if (Object.keys(kills).some((k) => !KINDS.includes(k))) return 'bad kills';

  if (kills.monster * POINTS.monster + kills.chest * POINTS.chest !== score) return 'score does not match kills';
  if (!(elapsedMs > 0)) return 'session expired';
  const secs = elapsedMs / 1000;

  const level = wave;
  if (kills.chest < ROOMS_PER_LEVEL * (level - 1)) return 'level without the treasures';
  if (kills.chest > kills.entries) return 'more chests than visits';
  if (kills.monster > MAX_MONSTERS_PER_ROOM * kills.entries) return 'more monsters than spawned';
  if (kills.entries > secs / MIN_VISIT_SECS + 1) return 'visits too fast';
  if (kills.chest > secs / MIN_CHEST_SECS + 1) return 'treasures too fast';
  if (kills.monster > secs / MIN_KILL_SECS + MAX_MONSTERS_PER_ROOM) return 'kills faster than the bow fires';
  return null;
}
