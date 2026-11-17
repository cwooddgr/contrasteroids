// Talks to the score server (server/). Everything here fails quietly: with no
// network the game plays as before, just without the online boards.

import { KILL_KINDS } from './scoring.js';

const API = import.meta.env.VITE_SCORES_API || 'https://scores.dgrlabs.co';
const TIMEOUT = 8000;

async function call(path, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(API + path, body === undefined
      ? { signal: ctl.signal, cache: 'no-store' }
      : { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error || `http ${res.status}` };
  } catch {
    return { error: 'offline' };
  } finally {
    clearTimeout(t);
  }
}

export const newKills = () => Object.fromEntries(KILL_KINDS.map((k) => [k, 0]));

export class Scores {
  constructor() {
    this.boards = { easy: null, hard: null }; // { day, today, allTime }
    this.version = 0; // bumps when boards change, for the HUD's redraw key
  }

  async refresh(mode) {
    const b = await call(`/scores?mode=${mode}`);
    if (b.error || !Array.isArray(b.today)) return;
    this.boards[mode] = b;
    this.version++;
  }

  // Resolves to a session id, or null if the server can't be reached.
  async start(mode) {
    const r = await call('/start', { mode });
    return r.session || null;
  }

  submit(run) { return call('/submit', run); }

  // Would this score make today's top ten? (Anything that makes the all-time
  // board also makes today's.) Unknown boards count as yes; the server decides.
  qualifies(mode, score) {
    if (score <= 0) return false;
    const b = this.boards[mode];
    if (!b) return true;
    if (b.day !== new Date().toISOString().slice(0, 10)) return true;
    return b.today.length < 10 || score > b.today[b.today.length - 1].score;
  }
}
