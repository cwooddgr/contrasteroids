// Scoring rules shared by the game and the score server (server/src/index.js),
// so the server's plausibility check always matches the game it's checking.
// No imports: the Worker bundles this file as is.

// Points for each kind of kill. r3/r2/r1 are large, medium, and small rocks.
export const POINTS = { r3: 20, r2: 50, r1: 100, mine: 50, skiff: 200, layer: 500, hunter: 1000 };
export const KILL_KINDS = Object.keys(POINTS);

export const MODES = ['easy', 'hard'];

// Large rocks at the start of wave w.
export const waveRocks = (w) => Math.min(3 + w, 11);

// Timing limits from game.js. The check only uses physical limits a real game
// can't exceed, so it never rejects a genuine score.
export const FIRE_COOLDOWN = 0.16; // s between our shots
export const WAVE_DELAY = 2.5; // s of empty screen before each new wave
export const ALIEN_MIN_GAP = 4.5; // s, the shortest alien spawn interval (9 s x 0.5)
export const MINE_MIN_GAP = 2.4; // s between drops from one Layer; at most 3 aliens at once
export const MAX_GAME_MS = 6 * 3600 * 1000; // a session expires after 6 hours

// Arcade initials: three letters, minus a short blocklist.
const BLOCKED = new Set([
  'ASS', 'CNT', 'COC', 'COK', 'CUM', 'DIC', 'DIK', 'FAG', 'FCK', 'FUC', 'FUK', 'FUQ',
  'JIZ', 'KKK', 'KYK', 'NAZ', 'NGA', 'NGR', 'NIG', 'SHT', 'SUK', 'TIT', 'TWT', 'VAG',
]);
export const initialsOk = (s) => typeof s === 'string' && /^[A-Z]{3}$/.test(s) && !BLOCKED.has(s);

// The UTC day a score belongs to, as YYYY-MM-DD.
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// Checks a finished game against the rules. Returns null if it's plausible,
// otherwise a short reason. elapsedMs is server time from session start to
// submission, which is always at least the game's own time (pauses only add).
export function checkRun({ score, wave, kills }, elapsedMs) {
  const int = (n) => Number.isSafeInteger(n) && n >= 0;
  if (!int(score) || !int(wave) || wave < 1 || wave > 10000) return 'bad numbers';
  if (!kills || typeof kills !== 'object') return 'bad kills';
  for (const k of KILL_KINDS) if (!int(kills[k])) return 'bad kills';
  if (Object.keys(kills).some((k) => !(k in POINTS))) return 'bad kills';

  const sum = KILL_KINDS.reduce((s, k) => s + kills[k] * POINTS[k], 0);
  if (sum !== score) return 'score does not match kills';

  if (!(elapsedMs > 0) || elapsedMs > MAX_GAME_MS) return 'session expired';
  const secs = elapsedMs / 1000;

  // Reaching wave w takes at least w - 1 wave delays.
  if (secs < WAVE_DELAY * (wave - 1)) return 'waves too fast';

  // Every large rock ever spawned came from a wave start, every medium from a
  // large breaking, and every small from a medium breaking.
  let large = 0;
  for (let w = 1; w <= wave; w++) large += waveRocks(w);
  if (kills.r3 > large || kills.r2 > 2 * large || kills.r1 > 4 * large) return 'more rocks than spawned';

  // Aliens arrive one at a time on a timer; mines come from Layers.
  const aliens = kills.skiff + kills.layer + kills.hunter;
  if (aliens > secs / ALIEN_MIN_GAP + 2) return 'too many aliens';
  if (kills.mine > 3 * (secs / MINE_MIN_GAP + 1)) return 'too many mines';

  // Nearly every kill takes a shot (ramming costs a life, so allow some slack).
  const all = KILL_KINDS.reduce((s, k) => s + kills[k], 0);
  if (all > secs / FIRE_COOLDOWN + 30) return 'kills faster than the gun fires';

  return null;
}
