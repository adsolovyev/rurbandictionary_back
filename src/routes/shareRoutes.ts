// src/routes/shareRoutes.ts
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/telegram', upload.single('image'), async (req, res) => {
  try {
    const { word, definition, example, url } = req.body;
    const imageBuffer = req.file?.buffer;
    if (!imageBuffer) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn('Telegram credentials not configured');
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    // Формируем подпись
    let caption = `<b>${word}</b>\n${definition}`;
    if (example) {
      caption += `\n<i>Пример: ${example}</i>`;
    }
    caption += `\n\nПодробнее: ${url}`;

    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    // Исправленный Blob
    formData.append('photo', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'card.png');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('reply_markup', JSON.stringify({
      inline_keyboard: [[{ text: 'Открыть на сайте', url }]]
    }));

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Telegram API error:', data);
      return res.status(500).json({ error: 'Telegram API error' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;