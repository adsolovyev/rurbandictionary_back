import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mail.ru';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER;   // полный email
const SMTP_PASS = process.env.SMTP_PASS;   // пароль или пароль приложения
const SMTP_FROM = process.env.SMTP_FROM;   // тот же email

if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.warn('SMTP credentials not configured');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true для 465, false для 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    // Для Mail.ru иногда требуется явно указать
    rejectUnauthorized: false,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`sendEmail called: to=${to}, subject=${subject}`);
  if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('SMTP credentials not configured, skipping email');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Russian Urban Dictionary" <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent via Mail.ru SMTP, messageId: ${info.messageId}`);
  } catch (err) {
    console.error('Failed to send email:', err);
    if (err instanceof Error) {
      console.error('Stack:', err.stack);
    }
  }
}