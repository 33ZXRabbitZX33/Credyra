const crypto = require('crypto');
const { createSessionCookie } = require('./_auth');
const { lockedMinutes, recordFailure, recordSuccess } = require('./_loginGuard');

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

  const locked = await lockedMinutes(req);
  if (locked) {
    res.status(429).json({ error: `Đăng nhập sai quá nhiều lần. Thử lại sau ${locked} phút.` });
    return;
  }

  const { username, password } = req.body || {};
  const userOk = safeEqual(username, process.env.AUTH_USERNAME || '');
  const passOk = safeEqual(password, process.env.AUTH_PASSWORD || '');

  if (!userOk || !passOk) {
    const r = await recordFailure(req);
    res.status(r.lockedMinutes ? 429 : 401).json({
      error: r.lockedMinutes
        ? `Đăng nhập sai quá nhiều lần. Thử lại sau ${r.lockedMinutes} phút.`
        : `Sai tài khoản hoặc mật khẩu (còn ${r.remaining} lần thử)`,
    });
    return;
  }

  await recordSuccess(req);
  res.setHeader('Set-Cookie', createSessionCookie(username));
  res.status(200).json({ ok: true, username });
};
