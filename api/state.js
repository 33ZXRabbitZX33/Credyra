const { put, get } = require('@vercel/blob');
const { verifySession } = require('./_auth');

const STATE_PATHNAME = 'state.json';

module.exports = async (req, res) => {
  const session = verifySession(req);
  if (!session) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const result = await get(STATE_PATHNAME, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200) {
        res.status(200).json({ state: null });
        return;
      }
      const text = await new Response(result.stream).text();
      res.status(200).json({ state: JSON.parse(text) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi khi đọc dữ liệu' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      await put(STATE_PATHNAME, JSON.stringify(req.body), {
        access: 'private',
        contentType: 'application/json',
        allowOverwrite: true,
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi khi lưu dữ liệu' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
