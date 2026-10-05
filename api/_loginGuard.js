const { put, get } = require('@vercel/blob');

// Brute-force protection for the single login. State lives in Blob so it is shared
// across serverless instances.
//  - per IP: MAX_PER_IP failures within WINDOW -> that IP is locked for LOCK_MS
//  - global: MAX_GLOBAL failures within WINDOW from any IPs -> login locked for everyone
//    (stops guessing spread over many IPs; the owner usually still has a 30-day session)
const PATHNAME = 'login-guard.json';
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 30;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.headers['x-real-ip'] || 'unknown').trim();
}

async function load() {
  try {
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return { ips: {}, global: { fails: [], lockedUntil: 0 } };
    return JSON.parse(await new Response(result.stream).text());
  } catch (e) {
    return { ips: {}, global: { fails: [], lockedUntil: 0 } };
  }
}

async function store(data) {
  await put(PATHNAME, JSON.stringify(data), { access: 'private', contentType: 'application/json', allowOverwrite: true });
}

function prune(data, now) {
  data.global.fails = data.global.fails.filter(t => now - t < WINDOW_MS);
  for (const [ip, rec] of Object.entries(data.ips)) {
    rec.fails = rec.fails.filter(t => now - t < WINDOW_MS);
    if (!rec.fails.length && (rec.lockedUntil || 0) < now) delete data.ips[ip];
  }
}

// Returns minutes remaining if locked, else 0.
async function lockedMinutes(req) {
  const now = Date.now();
  const data = await load();
  const rec = data.ips[clientIp(req)];
  const until = Math.max(data.global.lockedUntil || 0, (rec && rec.lockedUntil) || 0);
  return until > now ? Math.ceil((until - now) / 60000) : 0;
}

async function recordFailure(req) {
  const now = Date.now();
  const data = await load();
  prune(data, now);
  const ip = clientIp(req);
  const rec = data.ips[ip] || (data.ips[ip] = { fails: [], lockedUntil: 0 });
  rec.fails.push(now);
  data.global.fails.push(now);
  if (rec.fails.length >= MAX_PER_IP) { rec.lockedUntil = now + LOCK_MS; rec.fails = []; }
  if (data.global.fails.length >= MAX_GLOBAL) { data.global.lockedUntil = now + LOCK_MS; data.global.fails = []; }
  await store(data);
  return { remaining: Math.max(0, MAX_PER_IP - rec.fails.length), lockedMinutes: rec.lockedUntil > now ? Math.ceil(LOCK_MS / 60000) : 0 };
}

async function recordSuccess(req) {
  const data = await load();
  const ip = clientIp(req);
  if (data.ips[ip]) {
    delete data.ips[ip];
    await store(data);
  }
}

module.exports = { lockedMinutes, recordFailure, recordSuccess };
