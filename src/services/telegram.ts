// src/services/telegram.ts

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;


console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'present' : 'missing');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID ? 'present' : 'missing');
/**
 * Отправляет сообщение в Telegram (fire-and-forget).
 * Если токен или chat_id не заданы — просто логирует предупреждение.
 * Ошибки логируются, но не выбрасываются наружу.
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram credentials not configured, skipping notification');
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram API error (${response.status}): ${errorText}`);
    } else {
      console.log('Telegram notification sent successfully');
    }
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
}