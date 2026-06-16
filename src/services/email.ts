import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'pro.eu.turbo-smtp.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;   // Consumer Key
const SMTP_PASS = process.env.SMTP_PASS;   // Consumer Secret
const SMTP_FROM = process.env.SMTP_FROM;   // email отправителя

if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.warn('SMTP credentials not configured');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true для порта 465, false для 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
    console.log(`sendEmail called: to=${to}, subject=${subject}`);
    if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
        console.warn('SMTP credentials not configured, skipping email');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}, messageId: ${info.messageId}`);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}