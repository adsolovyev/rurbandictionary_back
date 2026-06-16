import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;   // ваш email
const SMTP_PASS = process.env.SMTP_PASS;   // пароль приложения
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn('Gmail SMTP credentials not configured');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 587 — secure: false, STARTTLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`sendEmail called: to=${to}, subject=${subject}`);
  if (!SMTP_USER || !SMTP_PASS) {
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
    console.log(`Email sent via Gmail SMTP, messageId: ${info.messageId}`);
  } catch (err) {
    console.error('Failed to send email:', err);
    if (err instanceof Error) {
      console.error('Stack:', err.stack);
    }
  }
}