import nodemailer from 'nodemailer';

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const transporter = configured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
}) : null;

const from = process.env.SMTP_FROM || 'Mentoria A Mecânica <no-reply@localhost>';
const appUrl = process.env.APP_URL || 'http://localhost:3000';

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!transporter) return false;
  await transporter.sendMail({ from, to, subject, text, html });
  return true;
}

export async function sendWelcomeEmail(to: string, name: string, password: string): Promise<boolean> {
  return sendMail(to, 'Seu acesso à Mentoria A Mecânica',
    `Olá, ${name}. Seu acesso está disponível em ${appUrl}. E-mail: ${to}. Senha inicial: ${password}. Altere a senha no primeiro acesso.`,
    `<p>Olá, ${name}.</p><p>Seu acesso está disponível em <a href="${appUrl}">${appUrl}</a>.</p><p><b>E-mail:</b> ${to}<br><b>Senha inicial:</b> ${password}</p><p>Altere a senha no primeiro acesso.</p>`);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = `${appUrl}/?resetToken=${encodeURIComponent(token)}`;
  return sendMail(to, 'Redefinição de senha — Mentoria A Mecânica',
    `Olá, ${name}. Acesse ${link} para redefinir sua senha. Este link expira em 1 hora.`,
    `<p>Olá, ${name}.</p><p><a href="${link}">Clique aqui para redefinir sua senha</a>.</p><p>O link expira em 1 hora e pode ser usado uma única vez.</p>`);
}
