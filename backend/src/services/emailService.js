const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Provider-agnostic transactional email over SMTP (Nodemailer). Configure any
 * transactional provider (Resend, Mailgun, SendGrid, ...) via SMTP env vars:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for 465),
 *   SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * If SMTP is not configured the service degrades gracefully: it logs the email
 * (and, for password resets, the reset link) instead of throwing, so local dev
 * and the demo keep working and the flow stays testable before a provider is
 * wired up. No user-facing behaviour depends on delivery succeeding.
 */
const FROM = process.env.EMAIL_FROM || 'Mindspace <no-reply@mindspace.local>';

const isConfigured = () => Boolean(process.env.SMTP_HOST);

let transporter = null;
const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
};

async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    logger.warn('[email] SMTP not configured; message not delivered', { to, subject });
    return { sent: false };
  }
  await t.sendMail({ from: FROM, to, subject, text, html });
  logger.info('[email] sent', { to, subject });
  return { sent: true };
}

async function sendPasswordResetEmail(to, resetUrl) {
  const subject = 'Reset your Mindspace password';
  const text =
    'You (or someone) asked to reset your Mindspace password.\n\n' +
    `Reset it here (this link expires in 1 hour):\n${resetUrl}\n\n` +
    'If you did not request this, you can ignore this email and your password will not change.';
  const html =
    '<p>You (or someone) asked to reset your Mindspace password.</p>' +
    `<p><a href="${resetUrl}">Reset your password</a> (this link expires in 1 hour).</p>` +
    '<p>If you did not request this, you can ignore this email and your password will not change.</p>';

  const result = await sendMail({ to, subject, text, html });
  if (!result.sent) {
    // Surface the link in logs so the flow is testable before SMTP exists.
    logger.info('[email] password-reset link (SMTP not configured)', { to, resetUrl });
  }
  return result;
}

module.exports = { sendPasswordResetEmail, isConfigured, sendMail };
