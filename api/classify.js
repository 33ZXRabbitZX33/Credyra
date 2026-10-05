const Anthropic = require('@anthropic-ai/sdk');
const { verifySession } = require('./_auth');

// Must stay in sync with CATEGORIES in index.html.
const CATEGORIES = ['App & subscription', 'Hóa đơn & dịch vụ', 'Ăn vặt & cafe', 'Mua sắm', 'Ăn uống',
  'Di chuyển', 'Giải trí', 'Quà & hiếu hỉ', 'Linh tinh'];

module.exports = async (req, res) => {
  if (!verifySession(req)) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const desc = (req.body && typeof req.body.desc === 'string') ? req.body.desc.trim().slice(0, 120) : '';
  if (!desc) {
    res.status(400).json({ error: 'Thiếu nội dung' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'Chưa cấu hình API key' });
    return;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: 'Bạn phân loại một khoản chi tiêu cá nhân của người Việt (thường viết tắt, không dấu) vào đúng một nhóm. Chọn "Linh tinh" nếu thật sự không xác định được.',
      messages: [{ role: 'user', content: `Khoản chi: "${desc}"` }],
      tools: [{
        name: 'set_category',
        description: 'Gán nhóm cho khoản chi',
        strict: true,
        input_schema: {
          type: 'object',
          properties: { category: { type: 'string', enum: CATEGORIES } },
          required: ['category'],
          additionalProperties: false,
        },
      }],
      tool_choice: { type: 'tool', name: 'set_category' },
    });
    const toolUse = response.content.find(b => b.type === 'tool_use');
    const category = toolUse && CATEGORIES.includes(toolUse.input.category) ? toolUse.input.category : 'Linh tinh';
    res.status(200).json({ category });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || 'AI lỗi' });
  }
};
