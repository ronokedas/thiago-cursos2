import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { seedDatabase } from './server/seed.js';
import { authRouter } from './server/routes/auth.js';
import { studentRouter } from './server/routes/student.js';
import { adminRouter } from './server/routes/admin.js';
import { streamRouter } from './server/routes/stream.js';
import { initializePostgres } from './server/postgres.js';
import { hydrateDatabaseFromPostgres, readDb, writeDb } from './server/db.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ENCRYPTION_KEY) {
    throw new Error('APP_ENCRYPTION_KEY é obrigatória em produção.');
  }
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

  // Initialize PostgreSQL and hydrate the compatibility model before seeding.
  await initializePostgres(path.join(process.cwd(), 'data', 'database.json'));
  await hydrateDatabaseFromPostgres();
  seedDatabase();
  setInterval(() => {
    const db = readDb();
    const now = Date.now();
    const beforeSessions = db.sessions.length;
    db.sessions = db.sessions.filter(session => session.isActive || now - new Date(session.revokedAt || session.expiresAt).getTime() < 90 * 24 * 60 * 60 * 1000);
    db.passwordResetTokens = db.passwordResetTokens.filter(token => !token.usedAt && new Date(token.expiresAt).getTime() > now);
    if (db.sessions.length !== beforeSessions) writeDb(db);
  }, 60 * 60 * 1000).unref();

  // Basic Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Same-origin protection for cookie-authenticated state-changing requests.
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.cookies?.mecanica_session) {
      const origin = req.headers.origin;
      const expected = process.env.APP_URL;
      if (origin && expected && origin !== expected && origin !== `http://localhost:${PORT}`) {
        res.status(403).json({ error: 'Origem não autorizada.' });
        return;
      }
    }
    next();
  });

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/stream', streamRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      platform: 'Mentoria A Mecânica',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled request error:', err?.message || err);
    if (res.headersSent) return;
    const isUploadError = err?.name === 'MulterError' || String(err?.message || '').includes('arquivo MP4') || String(err?.message || '').includes('somente imagens JPEG');
    const status = isUploadError ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : Number(err?.statusCode || err?.status) || 500;
    const message = err?.code === 'LIMIT_FILE_SIZE'
      ? (err?.field === 'image' ? 'A imagem excede o limite de 10 MB.' : 'O arquivo excede o limite de 1 GB.')
      : (status === 500 ? 'Erro interno do servidor.' : String(err.message || 'Requisição inválida.'));
    res.status(status).json({ error: message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Mentoria A Mecânica — Plataforma de Membros`);
    console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
    console.log(`👤 Administrador inicial configurado.`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
