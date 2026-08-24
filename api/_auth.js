const crypto = require('crypto');

const COOKIE_NAME = 'credyra_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(payload) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update(payload).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function createSessionCookie(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString('base64url');
  const sig = sign(payload);
  return `${COOKIE_NAME}=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function verifySession(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data.exp || data.exp < Date.now()) return null;
  return data;
}

module.exports = { createSessionCookie, clearSessionCookie, verifySession };
