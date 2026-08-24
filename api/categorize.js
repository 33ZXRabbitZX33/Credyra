const Anthropic = require('@anthropic-ai/sdk');

const CATEGORIES = ['Ăn uống', 'Di chuyển', 'Giải trí', 'Mua sắm', 'Hóa đơn & dịch vụ', 'Sức khỏe', 'Khác'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Thiếu nội dung cần phân tích' });
    return;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      output_config: { effort: 'low' },
      system: `Bạn là bộ máy trích xuất chi tiêu cá nhân từ văn bản tiếng Việt viết tay, không trang trọng. Với MỖI dòng người dùng nhập, trích ra: mô tả ngắn gọn (bỏ phần số tiền), số tiền quy đổi ra VNĐ dạng số nguyên (hiểu "100k"=100000, "1tr"/"1 triệu"=1000000, "20000đ"=20000, "20k5"=20500...), và một danh mục ĐÚNG MỘT trong danh sách: ${CATEGORIES.join(', ')}. Bỏ qua các dòng trống hoặc không có số tiền nhận diện được.`,
      messages: [{ role: 'user', content: text }],
      tools: [{
        name: 'record_expenses',
        description: 'Danh sách các khoản chi tiêu đã được trích xuất và phân loại',
        strict: true,
        input_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  amount: { type: 'integer' },
                  category: { type: 'string', enum: CATEGORIES },
                },
                required: ['description', 'amount', 'category'],
                additionalProperties: false,
              },
            },
          },
          required: ['items'],
          additionalProperties: false,
        },
      }],
      tool_choice: { type: 'tool', name: 'record_expenses' },
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse) {
      res.status(502).json({ error: 'Không nhận được kết quả phân tích từ AI' });
      return;
    }

    res.status(200).json({ items: toolUse.input.items || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi máy chủ' });
  }
};
