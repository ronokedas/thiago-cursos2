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
}

const activeTickets = new Map<string, StreamTicket>();

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [token, ticket] of activeTickets.entries()) {
    if (ticket.expiresAt < now) {
      activeTickets.delete(token);
    }
  }
}, 60000);

export function generateStreamTicket(userId: string, lessonId: string, clientIp: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  activeTickets.set(token, {
    token,
    userId,
    lessonId,
    clientIp,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000, // Valid for 2 hours during continuous playback
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

  // Check if physical video exists on server
  let videoPath = lesson.videoFileName ? path.join(VIDEO_DIR, lesson.videoFileName) : null;

  if (!videoPath || !fs.existsSync(videoPath)) {
    // If no video was uploaded yet, check if there's a demo sample or serve a generated placeholder
    const samplePath = path.join(VIDEO_DIR, 'sample.mp4');
    if (fs.existsSync(samplePath)) {
      videoPath = samplePath;
    }
  }

  // Security headers to prevent indexing & caching in unsafe intermediaries
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', 'inline');

  if (videoPath && fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });

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
      fs.createReadStream(videoPath).pipe(res);
    }
  } else {
    // Return structured video fallback or dynamic manifest
    res.status(200).json({
      status: 'DEMO_STREAM_READY',
      message: 'Vídeo institucional demonstrativo ativo. Faça upload do arquivo MP4 no painel administrativo.',
      lessonId: lesson.id,
      title: lesson.title,
    });
  }
}
