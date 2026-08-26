import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { readDb, writeDb, writeDbAndWait, User, PasswordResetToken } from '../db.js';
import { verifyPassword, hashPassword, createSession, extractAuth, requireAuth, hashToken } from '../auth.js';
import { logAudit } from '../audit.js';
import rateLimit from 'express-rate-limit';
import { sendPasswordResetEmail } from '../email.js';

export const authRouter = Router();
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

function publicAuthUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

// POST /api/auth/login
authRouter.post('/login', credentialLimiter, (req: Request, res: Response): void => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    return;
  }

  if (user.status === 'BLOCKED') {
    res.status(403).json({ error: 'Esta conta foi bloqueada. Entre em contato com o suporte.' });
    return;
  }

  if (user.status === 'SUSPENDED') {
    res.status(403).json({ error: 'Seu acesso está temporariamente suspenso. Entre em contato com a administração.' });
    return;
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    return;
  }

  // Create single active session (invalidating any previous session)
  const { session, rawToken } = createSession(user, req);

  // Set secure HttpOnly cookie
  res.cookie('mecanica_session', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({
    message: 'Login realizado com sucesso.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      startDate: user.startDate,
      expirationDate: user.expirationDate,
      forcePasswordChange: user.forcePasswordChange,
    },
    session: {
      id: session.id,
      deviceInfo: session.deviceInfo,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress,
      device: session.deviceInfo,
    },
    token: rawToken, // Provided for Authorization header fallback
  });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response): void => {
  const auth = extractAuth(req);
  if (!auth) {
    res.status(401).json({ error: 'Não autenticado ou sessão revogada em outro dispositivo.' });
    return;
  }

  const { user, session } = auth;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      startDate: user.startDate,
      expirationDate: user.expirationDate,
      firstAccessAt: user.firstAccessAt,
      lastAccessAt: user.lastAccessAt,
      forcePasswordChange: user.forcePasswordChange,
    },
    session: {
      id: session.id,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress,
      device: session.deviceInfo,
    },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response): void => {
  const auth = extractAuth(req);
  if (auth) {
    const db = readDb();
    const sess = db.sessions.find(s => s.id === auth.session.id);
    if (sess) {
      sess.isActive = false;
      sess.revokedAt = new Date().toISOString();
      sess.revokedReason = 'LOGOUT_USUARIO';
      writeDb(db);
    }
    logAudit({
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'LOGOUT',
      entityType: 'SESSION',
      entityId: auth.session.id,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    });
  }

  res.clearCookie('mecanica_session', { path: '/' });
  res.json({ message: 'Sessão encerrada com sucesso.' });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const db = readDb();
  const dbUser = db.users.find(u => u.id === req.auth.user.id);
  if (!dbUser) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
  const name = req.body?.name;
  const email = req.body?.email;
  if (name !== undefined && String(name).trim().length < 2) { res.status(400).json({ error: 'Informe um nome válido.' }); return; }
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { res.status(400).json({ error: 'Informe um e-mail válido.' }); return; }
    if (db.users.some(u => u.id !== dbUser.id && u.email.toLowerCase() === normalizedEmail)) { res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' }); return; }
    dbUser.email = normalizedEmail;
  }
  if (name !== undefined) dbUser.name = String(name).trim();
  dbUser.updatedAt = new Date().toISOString();
  await writeDbAndWait(db);
  logAudit({ actorId: dbUser.id, actorName: dbUser.name, actorRole: dbUser.role, action: 'UPDATE_OWN_PROFILE', entityType: 'USER', entityId: dbUser.id, details: { name: dbUser.name, email: dbUser.email } });
  res.json({ message: 'Perfil atualizado com sucesso.', user: publicAuthUser(dbUser) });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const { newPassword, currentPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' });
    return;
  }

  const user = req.auth.user as User;
  const db = readDb();
  const dbUser = db.users.find(u => u.id === user.id);

  if (!dbUser) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  // Normal password changes always require the current password. Forced first access does not.
  if (!dbUser.forcePasswordChange) {
    if (!currentPassword) { res.status(400).json({ error: 'Informe a senha atual.' }); return; }
    const isCurrentValid = verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      res.status(400).json({ error: 'A senha atual está incorreta.' });
      return;
    }
  }

  dbUser.passwordHash = hashPassword(newPassword);
  dbUser.forcePasswordChange = false;
  dbUser.updatedAt = new Date().toISOString();
  await writeDbAndWait(db);

  logAudit({
    actorId: dbUser.id,
    actorName: dbUser.name,
    actorRole: dbUser.role,
    action: 'PASSWORD_CHANGED',
    entityType: 'USER',
    entityId: dbUser.id,
  });

  res.json({ message: 'Senha alterada com sucesso.' });
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', credentialLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Informe seu e-mail.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  // Security: Do not reveal if email exists or not
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetToken: PasswordResetToken = {
      id: `tok_${crypto.randomUUID()}`,
      userId: user.id,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
    };

    db.passwordResetTokens.push(resetToken);
    writeDb(db);

    logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
      details: { tokenPreview: rawToken.substring(0, 8) + '...' },
    });

    const sent = await sendPasswordResetEmail(user.email, user.name, rawToken);
    if (!sent && process.env.NODE_ENV !== 'production' && process.env.DEV_LOG_RESET_TOKEN === 'true') {
      console.warn(`[DEV] Token de recuperação gerado para ${user.email}; configure SMTP para envio real.`);
      console.warn(rawToken);
    }
  }

  res.json({
    message: 'Se este e-mail estiver cadastrado, as instruções para redefinição foram enviadas.',
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', (req: Request, res: Response): void => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Token inválido ou senha com menos de 8 caracteres.' });
    return;
  }

  const tokenHash = hashToken(token);
  const db = readDb();
  const resetToken = db.passwordResetTokens.find(t => t.tokenHash === tokenHash && !t.usedAt);

  if (!resetToken || new Date(resetToken.expiresAt) < new Date()) {
    res.status(400).json({ error: 'Link de redefinição expirado ou inválido.' });
    return;
  }

  const user = db.users.find(u => u.id === resetToken.userId);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  user.passwordHash = hashPassword(newPassword);
  user.forcePasswordChange = false;
  user.updatedAt = new Date().toISOString();
  resetToken.usedAt = new Date().toISOString();

  // Invalidate all active sessions for security
  for (const s of db.sessions) {
    if (s.userId === user.id && s.isActive) {
      s.isActive = false;
      s.revokedAt = new Date().toISOString();
      s.revokedReason = 'PASSWORD_RESET';
    }
  }

  writeDb(db);

  logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'USER',
    entityId: user.id,
  });

  res.json({ message: 'Senha redefinida com sucesso. Faça login com sua nova senha.' });
});
