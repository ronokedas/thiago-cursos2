import nodemailer, { Transporter } from 'nodemailer';
import { readDb } from './db.js';
import { decryptSecret } from './secrets.js';

type SmtpConfig = { host: string; port: number; secure: boolean; username: string; password: string; from: string };
let cachedFingerprint = '';
let cachedTransporter: Transporter | null = null;

function getSmtpConfig(): SmtpConfig | null {
  const settings = readDb().systemSettings.smtp;
  const password = settings?.encryptedPassword ? decryptSecret(settings.encryptedPassword) : process.env.SMTP_PASSWORD || '';
  const host = settings?.host || process.env.SMTP_HOST || '';
  const username = settings?.username || process.env.SMTP_USER || '';
  if (!host || !username || !password) return null;
  return { host, port: Number(settings?.port || process.env.SMTP_PORT || 587), secure: settings?.secure ?? String(process.env.SMTP_SECURE).toLowerCase() === 'true', username, password, from: settings?.from || process.env.SMTP_FROM || 'Mentoria A Mecânica <no-reply@localhost>' };
}

function getTransporter(): { transporter: Transporter; config: SmtpConfig } | null {
  const config = getSmtpConfig();
  if (!config) return null;
  const fingerprint = JSON.stringify({ ...config, password: Buffer.from(config.password).toString('base64url').slice(0, 24) });
  if (!cachedTransporter || cachedFingerprint !== fingerprint) {
    cachedTransporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.username, pass: config.password }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    cachedFingerprint = fingerprint;
  }
  return { transporter: cachedTransporter, config };
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const active = getTransporter();
  if (!active) return false;
  await active.transporter.sendMail({ from: active.config.from, to, subject, text, html });
  return true;
}

export async function verifySmtp(): Promise<void> {
  const active = getTransporter();
  if (!active) throw new Error('SMTP não está configurado.');
  await active.transporter.verify();
}

export async function sendWelcomeEmail(to: string, name: string, password: string): Promise<boolean> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return sendMail(to, 'Seu acesso à Mentoria A Mecânica', `Olá, ${name}. Seu acesso está disponível em ${appUrl}. E-mail: ${to}. Senha inicial: ${password}. Altere a senha no primeiro acesso.`, `<p>Olá, ${name}.</p><p>Seu acesso está disponível em <a href="${appUrl}">${appUrl}</a>.</p><p><b>E-mail:</b> ${to}<br><b>Senha inicial:</b> ${password}</p><p>Altere a senha no primeiro acesso.</p>`);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/?resetToken=${encodeURIComponent(token)}`;
  return sendMail(to, 'Redefinição de senha — Mentoria A Mecânica',
    `Olá, ${name}. Acesse ${link} para redefinir sua senha. Este link expira em 1 hora.`,
    `<p>Olá, ${name}.</p><p><a href="${link}">Clique aqui para redefinir sua senha</a>.</p><p>O link expira em 1 hora e pode ser usado uma única vez.</p>`);
}

export async function sendSmtpTestEmail(to: string): Promise<void> {
  await verifySmtp();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const sent = await sendMail(to, 'Teste SMTP — Mentoria A Mecânica', `Este é um teste de configuração SMTP da Mentoria A Mecânica. Aplicação: ${appUrl}`, `<p>O SMTP da Mentoria A Mecânica foi configurado com sucesso.</p><p>Aplicação: ${appUrl}</p>`);
  if (!sent) throw new Error('SMTP não está configurado.');
}
