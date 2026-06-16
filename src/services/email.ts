// src/services/email.ts

// Конфигурация из переменных окружения
const UNISENDER_API_KEY = process.env.UNISENDER_API_KEY;
const UNISENDER_SENDER_EMAIL = process.env.UNISENDER_SENDER_EMAIL;
const UNISENDER_SENDER_NAME = process.env.UNISENDER_SENDER_NAME || 'Russian Urban Dictionary';

if (!UNISENDER_API_KEY || !UNISENDER_SENDER_EMAIL) {
  console.warn('Unisender Go credentials are not configured');
}

/**
 * Отправляет письмо через Web API Unisender Go
 * Документация: https://godocs.unisender.ru/web-api-ref#email-send
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`sendEmail called: to=${to}, subject=${subject}`);

  if (!UNISENDER_API_KEY || !UNISENDER_SENDER_EMAIL) {
    console.warn('Unisender Go credentials not configured, skipping email');
    return;
  }

  const url = 'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json';

  // Формируем тело запроса согласно документации
  const payload = {
    message: {
      recipients: [
        {
          email: to,
        },
      ],
      body: {
        html: html,
      },
      subject: subject,
      from_email: UNISENDER_SENDER_EMAIL,
      from_name: UNISENDER_SENDER_NAME,
      track_links: 0,        // Отключаем отслеживание ссылок для транзакционных писем
      track_read: 0,         // Отключаем отслеживание прочтений
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': UNISENDER_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(`Unisender Go API error (${response.status}): ${JSON.stringify(responseData)}`);
    }

    console.log(`Email sent via Unisender Go, response: ${JSON.stringify(responseData)}`);
  } catch (error) {
    console.error('Failed to send email via Unisender Go:', error);
  }
}