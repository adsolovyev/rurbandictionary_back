const MAILRU_EMAIL = process.env.MAILRU_EMAIL;
const MAILRU_PASSWORD = process.env.MAILRU_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || MAILRU_EMAIL;

if (!MAILRU_EMAIL || !MAILRU_PASSWORD) {
  console.warn('Mail.ru credentials not configured');
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`sendEmail called: to=${to}, subject=${subject}`);
  if (!MAILRU_EMAIL || !MAILRU_PASSWORD) {
    console.warn('Mail.ru credentials not configured, skipping email');
    return;
  }

  const from = SMTP_FROM || MAILRU_EMAIL;
  if (!from) {
    console.warn('From email not configured, skipping');
    return;
  }

  const params = new URLSearchParams();
  params.append('from', from);
  params.append('to', to);
  params.append('subject', subject);
  params.append('html', html);

  const auth = Buffer.from(`${MAILRU_EMAIL}:${MAILRU_PASSWORD}`).toString('base64');

  try {
    const response = await fetch('https://api.mail.ru/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: params,
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Mail.ru API error ${response.status}: ${responseText}`);
    }
    console.log(`Email sent via Mail.ru API, response: ${responseText}`);
  } catch (err) {
    console.error('Failed to send email via Mail.ru API:', err);
  }
}