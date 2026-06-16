// src/services/email.ts

const SMTP_API_HOST = process.env.SMTP_API_HOST || 'pro.api.turbo-smtp.com';
const SMTP_USER = process.env.SMTP_USER;   // Consumer Key
const SMTP_PASS = process.env.SMTP_PASS;   // Consumer Secret
const SMTP_FROM = process.env.SMTP_FROM;   // email отправителя

if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.warn('SMTP credentials not configured');
}

/**
 * Отправляет письмо через REST API turboSMTP
 * Использует Basic-авторизацию (Consumer Key / Consumer Secret)
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`sendEmail called: to=${to}, subject=${subject}`);
  if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('SMTP credentials not configured, skipping email');
    return;
  }

  const url = `https://${SMTP_API_HOST}/v1/email/send`;
  const auth = Buffer.from(`${SMTP_USER}:${SMTP_PASS}`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 секунд

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        from: SMTP_FROM,
        to: to,
        subject: subject,
        html: html,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`Email sent via API, messageId: ${data.messageId || 'unknown'}`);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('Request timeout');
    } else {
      console.error('Failed to send email via API:', err);
    }
    // Не пробрасываем ошибку дальше, чтобы не ломать основной процесс (мы вызываем без await)
  }
}