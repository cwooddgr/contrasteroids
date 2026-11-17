// Contrasteroids score server: daily and all-time top tens for Easy and Hard.
//
// The game is open source, so nothing the browser sends can be trusted. The
// defenses are what the server controls: it times each game itself (a session
// starts when the game does), each session can submit once, the score has to
// add up from the kills, and the kills have to fit the game's physical limits
// for that much time (see ../../src/scoring.js). A patient cheater can still
// fake a score that passes, so ADMIN_TOKEN can delete entries.
//
// GET    /scores?mode=easy   -> { day, today: [...], allTime: [...] }
// POST   /start {mode}       -> { session }
// POST   /submit {session, initials, score, wave, kills} -> { id, today, allTime }  (ranks)
// DELETE /scores/:id         (Authorization: Bearer ADMIN_TOKEN)

import { MODES, MAX_GAME_MS, checkRun, dayKey, initialsOk } from '../../src/scoring.js';

const TOP = 10;
const STARTS_PER_HOUR = 120; // per IP; a game can't be much shorter than 30 s
const MAX_BODY = 2048;

const ALLOWED_ORIGIN = /^(https:\/\/dgrlabs\.co|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGIN.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (request, body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) },
});
const fail = (request, status, error) => json(request, { error }, status);

async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const data = new TextEncoder().encode(`${env.SALT}|${ip}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

async function boards(env, mode, now) {
  const day = dayKey(now);
  const cols = 'id, initials, score, wave';
  const [today, allTime] = await env.DB.batch([
    env.DB.prepare(`SELECT ${cols} FROM scores WHERE mode = ? AND day = ? ORDER BY score DESC, created LIMIT ?`).bind(mode, day, TOP),
    env.DB.prepare(`SELECT ${cols} FROM scores WHERE mode = ? ORDER BY score DESC, created LIMIT ?`).bind(mode, TOP),
  ]);
  return { mode, day, today: today.results, allTime: allTime.results };
}

async function start(request, env, now) {
  const body = await readJson(request);
  if (!body || !MODES.includes(body.mode)) return fail(request, 400, 'bad mode');
  const ip = await ipHash(request, env);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE ip = ? AND created > ?')
    .bind(ip, now - 3600 * 1000).first('n');
  if (recent >= STARTS_PER_HOUR) return fail(request, 429, 'slow down');
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sessions (id, mode, created, ip) VALUES (?, ?, ?, ?)')
    .bind(id, body.mode, now, ip).run();
  return json(request, { session: id });
}

async function submit(request, env, now) {
  const body = await readJson(request);
  if (!body || typeof body.session !== 'string' || body.session.length > 64) return fail(request, 400, 'bad request');
  if (!initialsOk(body.initials)) return fail(request, 400, 'initials');

  // Claim the session first, so a rejected run can't be retried with other numbers.
  const s = await env.DB.prepare('UPDATE sessions SET used = 1 WHERE id = ? AND used = 0 RETURNING mode, created')
    .bind(body.session).first();
  if (!s) return fail(request, 409, 'session used or unknown');

  const elapsed = now - s.created;
  const run = { score: body.score, wave: body.wave, kills: body.kills };
  const why = checkRun(run, elapsed);
  if (why) {
    console.log(JSON.stringify({ rejected: why, mode: s.mode, elapsed, run }));
    return fail(request, 422, 'rejected');
  }
  if (run.score === 0) return fail(request, 422, 'rejected');

  const day = dayKey(now);
  const ip = await ipHash(request, env);
  const row = await env.DB.prepare(`INSERT INTO scores (mode, day, initials, score, wave, kills, secs, created, ip, session)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(s.mode, day, body.initials, run.score, run.wave, JSON.stringify(run.kills), Math.round(elapsed / 1000), now, ip, body.session)
    .first();

  // Rank: higher scores first, then earlier entries at the same score.
  const ahead = 'score > ?1 OR (score = ?1 AND id < ?2)';
  const [today, allTime] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE mode = ?3 AND day = ?4 AND (${ahead})`).bind(run.score, row.id, s.mode, day),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE mode = ?3 AND (${ahead})`).bind(run.score, row.id, s.mode),
  ]);
  return json(request, { id: row.id, today: today.results[0].n + 1, allTime: allTime.results[0].n + 1 });
}

async function remove(request, env, id) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return fail(request, 401, 'unauthorized');
  const r = await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
  return json(request, { deleted: r.meta.changes });
}

export default {
  async fetch(request, env) {
    if (!env.SALT) return fail(request, 500, 'not configured');
    const url = new URL(request.url);
    const now = Date.now();
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    try {
      if (url.pathname === '/scores' && request.method === 'GET') {
        const mode = url.searchParams.get('mode');
        if (!MODES.includes(mode)) return fail(request, 400, 'bad mode');
        return json(request, await boards(env, mode, now));
      }
      if (url.pathname === '/start' && request.method === 'POST') return await start(request, env, now);
      if (url.pathname === '/submit' && request.method === 'POST') return await submit(request, env, now);
      const del = url.pathname.match(/^\/scores\/(\d{1,12})$/);
      if (del && request.method === 'DELETE') return await remove(request, env, Number(del[1]));
      return fail(request, 404, 'not found');
    } catch (e) {
      console.error(e);
      return fail(request, 500, 'server error');
    }
  },

  // Daily: drop sessions too old to submit.
  async scheduled(event, env) {
    await env.DB.prepare('DELETE FROM sessions WHERE created < ?').bind(Date.now() - MAX_GAME_MS - 3600 * 1000).run();
  },
};
