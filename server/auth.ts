import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { readDb, writeDb, User, Session } from './db.js';
import { logAudit } from './audit.js';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
const lastSessionTouch = new Map<string, number>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  const [salt, hash] = combinedHash.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + numbers + symbols;

  let pwd = '';
  pwd += upper[crypto.randomInt(0, upper.length)];
  pwd += lower[crypto.randomInt(0, lower.length)];
  pwd += numbers[crypto.randomInt(0, numbers.length)];
  pwd += symbols[crypto.randomInt(0, symbols.length)];

  for (let i = 4; i < length; i++) {
    pwd += all[crypto.randomInt(0, all.length)];
  }

  // Shuffle string
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(user: User, req: Request): { session: Session; rawToken: string } {
  const db = readDb();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Desconhecido';
  
  // Single active session enforcement:
  // Invalidate any previously active sessions for this user
  let revokedCount = 0;
  for (const s of db.sessions) {
    if (s.userId === user.id && s.isActive) {
      s.isActive = false;
      s.revokedAt = now.toISOString();
      s.revokedReason = 'NOVA_SESSAO_EM_OUTRO_DISPOSITIVO';
      revokedCount++;
    }
  }

  if (revokedCount > 0) {
    logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'SESSION_REVOKED_CONCURRENT',
      entityType: 'SESSION',
      entityId: user.id,
      details: { message: `Sessão anterior desconectada devido a novo login em: ${userAgent}` },
      ipAddress,
      userAgent,
    });
  }

  const session: Session = {
    id: `sess_${crypto.randomUUID()}`,
    userId: user.id,
    tokenHash,
    ipAddress,
    userAgent,
    deviceInfo: parseDevice(userAgent),
    isActive: true,
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
  };

  db.sessions.unshift(session);

  // Update user's access tracking
  const dbUser = db.users.find(u => u.id === user.id);
  if (dbUser) {
    if (!dbUser.firstAccessAt) {
      dbUser.firstAccessAt = now.toISOString();
    }
    dbUser.lastAccessAt = now.toISOString();
  }

  writeDb(db);

  logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'LOGIN_SUCCESS',
    entityType: 'SESSION',
    entityId: session.id,
    details: { ip: ipAddress, device: session.deviceInfo },
    ipAddress,
    userAgent,
  });

  return { session, rawToken };
}

function parseDevice(ua: string): string {
  if (/mobile/i.test(ua)) return 'Dispositivo Móvel';
  if (/tablet|ipad/i.test(ua)) return 'Tablet';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac OS';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Navegador Web';
}

export interface AuthContext {
  user: User;
  session: Session;
}

export function extractAuth(req: Request): AuthContext | null {
  const cookieToken = req.cookies?.mecanica_session;
  const authHeader = req.headers.authorization;
  let token = cookieToken;

  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) return null;

  const tokenHash = hashToken(token);
  const db = readDb();
  const session = db.sessions.find(s => s.tokenHash === tokenHash && s.isActive);

  if (!session) return null;

  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    session.isActive = false;
    session.revokedAt = new Date().toISOString();
    session.revokedReason = 'EXPIRED';
    writeDb(db);
    return null;
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.status === 'BLOCKED') {
    return null;
  }

  // Avoid rewriting the complete JSON/Postgres state for every video range request.
  const nowMs = Date.now();
  const lastTouch = lastSessionTouch.get(session.id) || 0;
  if (nowMs - lastTouch >= 60_000) {
    session.lastActivityAt = new Date(nowMs).toISOString();
    lastSessionTouch.set(session.id, nowMs);
    writeDb(db);
  }

  return { user, session };
}

export function requireAuth(req: Request & { auth?: AuthContext }, res: Response, next: NextFunction): void {
  const auth = extractAuth(req);
  if (!auth) {
    res.status(401).json({
      error: 'Sessão inválida ou desconectada por novo login em outro dispositivo.',
      code: 'UNAUTHENTICATED_OR_CONCURRENT_SESSION',
    });
    return;
  }

  if (auth.user.status === 'SUSPENDED') {
    res.status(403).json({
      error: 'Seu acesso está temporariamente suspenso. Entre em contato com o suporte.',
      code: 'USER_SUSPENDED',
    });
    return;
  }

  req.auth = auth;
  next();
}

export function requireAdmin(req: Request & { auth?: AuthContext }, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.auth || (req.auth.user.role !== 'SUPER_ADMIN' && req.auth.user.role !== 'ADMIN')) {
      res.status(403).json({
        error: 'Acesso restrito a administradores autorizados.',
        code: 'FORBIDDEN_ADMIN_ONLY',
      });
      return;
    }
    next();
  });
}
