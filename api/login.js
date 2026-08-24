const crypto = require('crypto');
const { createSessionCookie } = require('./_auth');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username, password } = req.body || {};
  const userOk = safeEqual(username, process.env.AUTH_USERNAME || '');
  const passOk = safeEqual(password, process.env.AUTH_PASSWORD || '');

  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    return;
  }

  res.setHeader('Set-Cookie', createSessionCookie(username));
  res.status(200).json({ ok: true, username });
};
