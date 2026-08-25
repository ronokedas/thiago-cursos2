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
import { hydrateDatabaseFromPostgres } from './server/db.js';

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
    const status = Number(err?.statusCode || err?.status) || 500;
    res.status(status).json({ error: status === 500 ? 'Erro interno do servidor.' : String(err.message || 'Requisição inválida.') });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Mentoria A Mecânica — Plataforma de Membros`);
    console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
    console.log(`👤 Super Admin padrão: admin@mecanica.com (Senha: Admin@Mecanica2026!)`);
    console.log(`🎓 Aluno Teste padrão: aluno@mecanica.com (Senha: Aluno@Mecanica2026!)`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
