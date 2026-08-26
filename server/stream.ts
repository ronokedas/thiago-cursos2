import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { readDb, VIDEO_DIR } from './db.js';
import { canUserAccessLesson } from './accessControl.js';
import { logAudit } from './audit.js';
import { extractAuth } from './auth.js';

interface StreamTicket {
  token: string;
  userId: string;
  lessonId: string;
  clientIp: string;
  expiresAt: number; // timestamp in ms
  mediaType: 'MAIN' | 'PRACTICAL';
  practicalVideoId?: string;
}

const activeTickets = new Map<string, StreamTicket>();
const STREAM_CHUNK_BYTES = Math.max(1024 * 1024, Number.parseInt(process.env.STREAM_CHUNK_BYTES || String(8 * 1024 * 1024), 10) || 8 * 1024 * 1024);

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [token, ticket] of activeTickets.entries()) {
    if (ticket.expiresAt < now) {
      activeTickets.delete(token);
    }
  }
}, 60000);

export function generateStreamTicket(userId: string, lessonId: string, clientIp: string, media: { type?: 'MAIN' | 'PRACTICAL'; practicalVideoId?: string } = {}): string {
  const token = crypto.randomBytes(24).toString('hex');
  activeTickets.set(token, {
    token,
    userId,
    lessonId,
    clientIp,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000, // Valid for 2 hours during continuous playback
    mediaType: media.type || 'MAIN',
    practicalVideoId: media.practicalVideoId,
  });
  return token;
}

export function handleStreamRequest(req: Request, res: Response): void {
  const { token } = req.params;
  if (!token) {
    res.status(400).send('Token de streaming não fornecido.');
    return;
  }

  const ticket = activeTickets.get(token);
  if (!ticket || ticket.expiresAt < Date.now()) {
    res.status(403).send('Token de streaming expirado ou inválido.');
    return;
  }

  const auth = extractAuth(req);
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  if (!auth || auth.user.id !== ticket.userId || ticket.clientIp !== clientIp) {
    res.status(403).send('Sessão inválida para este ticket de streaming.');
    return;
  }

  const db = readDb();
  const user = db.users.find(u => u.id === ticket.userId);
  const lesson = db.lessons.find(l => l.id === ticket.lessonId);

  if (!user || !lesson) {
    res.status(404).send('Aula ou usuário não encontrado.');
    return;
  }

  // Re-verify authorization in real-time
  const access = canUserAccessLesson(user.id, lesson.id);
  if (!access.allowed) {
    res.status(403).send('Acesso revogado ou bloqueado.');
    return;
  }

  let fileName = lesson.videoFileName;
  if (ticket.mediaType === 'PRACTICAL') {
    const progress = db.lessonProgress.find(item => item.userId === user.id && item.lessonId === lesson.id);
    if (!progress?.mainVideoEndedAt) { res.status(403).send('Finalize o vídeo principal para liberar este conteúdo.'); return; }
    fileName = lesson.practicalVideos.find(item => item.id === ticket.practicalVideoId)?.videoFileName;
  }
  // File names are generated internally and never accepted from the request.
  const videoPath = fileName ? path.join(VIDEO_DIR, path.basename(fileName)) : null;

  // Security headers to prevent indexing & caching in unsafe intermediaries
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Accel-Buffering', 'no');

  if (videoPath && fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : start + STREAM_CHUNK_BYTES - 1;
      const end = Math.min(requestedEnd, start + STREAM_CHUNK_BYTES - 1, fileSize - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= fileSize || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      req.once('close', () => file.destroy());

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      const file = fs.createReadStream(videoPath);
      req.once('close', () => file.destroy());
      file.pipe(res);
    }
  } else {
    res.status(404).json({ error: 'Vídeo ainda não está disponível para esta aula.' });
  }
}
