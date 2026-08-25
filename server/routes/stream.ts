import { Router } from 'express';
import { handleStreamRequest } from '../stream.js';
import { requireAuth } from '../auth.js';
import { generateStreamTicket } from '../stream.js';
import { Request, Response } from 'express';
import { readDb } from '../db.js';
import { canUserAccessLesson } from '../accessControl.js';

export const streamRouter = Router();

// GET /api/stream/video/:token
streamRouter.get('/video/:token', handleStreamRequest);
streamRouter.get('/ticket/:lessonId', requireAuth, (req: Request & { auth?: any }, res: Response): void => {
  const lesson = readDb().lessons.find(item => item.id === req.params.lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }
  const access = canUserAccessLesson(req.auth!.user.id, lesson.id);
  if (!access.allowed) {
    res.status(403).json({ error: 'Aula bloqueada.', access });
    return;
  }
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const token = generateStreamTicket(req.auth!.user.id, req.params.lessonId, clientIp);
  res.json({ token, streamUrl: `/api/stream/video/${token}`, expiresInSeconds: 7200 });
});
