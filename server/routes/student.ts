import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { readDb, writeDb, LessonProgress, User, MATERIAL_DIR } from '../db.js';
import { requireAuth } from '../auth.js';
import { canUserAccessLesson, canUserAccessModule, calculateDiffDays } from '../accessControl.js';
import { generateStreamTicket } from '../stream.js';

export const studentRouter = Router();

// Apply auth middleware to all student routes
studentRouter.use(requireAuth);

studentRouter.get('/material/:lessonId/:materialId', (req: Request & { auth?: any }, res: Response): void => {
  const db = readDb();
  const lesson = db.lessons.find(item => item.id === req.params.lessonId);
  if (!lesson || !canUserAccessLesson(req.auth!.user.id, lesson.id).allowed) { res.status(403).json({ error: 'Material não autorizado.' }); return; }
  const material = lesson.supplementaryMaterials.find(item => item.id === req.params.materialId);
  if (!material?.storageFileName) { res.status(404).json({ error: 'Material não encontrado.' }); return; }
  const filePath = path.join(MATERIAL_DIR, path.basename(material.storageFileName));
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Arquivo do material não encontrado.' }); return; }
  res.download(filePath, material.title);
});

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.substring(0, 2)}***` : `${name}***`;
  return `${maskedName}@${domain}`;
}

// GET /api/student/dashboard
studentRouter.get('/dashboard', (req: Request & { auth?: any }, res: Response): void => {
  const user = req.auth.user as User;
  const db = readDb();

  const diffDays = calculateDiffDays(user.startDate);
  const now = new Date();
  const expDate = new Date(user.expirationDate);
  const daysUntilExpiration = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isExpired = expDate < now;

  // Calculate overall course progress
  const publishedLessons = db.lessons.filter(l => l.status === 'PUBLISHED');
  const userProgresses = db.lessonProgress.filter(p => p.userId === user.id);
  const completedLessons = userProgresses.filter(p => p.isCompleted).length;
  const totalLessons = publishedLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Find last watched lesson
  let lastWatchedLesson = null;
  if (userProgresses.length > 0) {
    const sorted = [...userProgresses].sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime());
    const lastP = sorted[0];
    const lessonObj = db.lessons.find(l => l.id === lastP.lessonId);
    if (lessonObj) {
      const moduleObj = db.modules.find(m => m.id === lessonObj.moduleId);
      lastWatchedLesson = {
        id: lessonObj.id,
        title: lessonObj.title,
        moduleTitle: moduleObj?.title || 'Módulo',
        lastPositionSeconds: lastP.lastPositionSeconds,
        progressPercent: lastP.progressPercent,
      };
    }
  }

  // Fallback to first available lesson if none watched yet
  if (!lastWatchedLesson && publishedLessons.length > 0) {
    const firstLesson = publishedLessons[0];
    const moduleObj = db.modules.find(m => m.id === firstLesson.moduleId);
    lastWatchedLesson = {
      id: firstLesson.id,
      title: firstLesson.title,
      moduleTitle: moduleObj?.title || 'Módulo 1',
      lastPositionSeconds: 0,
      progressPercent: 0,
    };
  }

  res.json({
    student: {
      id: user.id,
      name: user.name,
      email: user.email,
      startDate: user.startDate,
      expirationDate: user.expirationDate,
      daysUntilExpiration,
      isExpired,
      daysSinceStart: diffDays,
    },
    metrics: {
      totalLessons,
      completedLessons,
      progressPercent,
    },
    lastWatchedLesson,
    settings: {
      platformName: db.systemSettings.platformName,
      brandTagline: db.systemSettings.brandTagline,
      supportEmail: db.systemSettings.supportEmail,
      noticeBanner: db.systemSettings.noticeBanner,
      telegramGroupUrl: db.systemSettings.telegramGroupUrl || '',
      telegramHelpMessage: db.systemSettings.telegramHelpMessage || '',
      telegramButtonLabel: db.systemSettings.telegramButtonLabel || '',
    },
  });
});

// GET /api/student/course
studentRouter.get('/course', (req: Request & { auth?: any }, res: Response): void => {
  const user = req.auth.user as User;
  const db = readDb();

  const mainCourse = db.courses.find(c => c.status === 'PUBLISHED') || db.courses[0];
  if (!mainCourse) {
    res.status(404).json({ error: 'Nenhum curso disponível no momento.' });
    return;
  }

  const modules = db.modules
    .filter(m => m.courseId === mainCourse.id && m.status === 'PUBLISHED')
    .sort((a, b) => a.position - b.position)
    .map(mod => {
      const accessMod = canUserAccessModule(user.id, mod.id);
      
      const topics = db.topics
        .filter(t => t.moduleId === mod.id)
        .sort((a, b) => a.position - b.position)
        .map(top => {
          const lessons = db.lessons
            .filter(l => l.topicId === top.id && l.status === 'PUBLISHED')
            .sort((a, b) => a.position - b.position)
            .map(les => {
              const accessLes = canUserAccessLesson(user.id, les.id);
              const progress = db.lessonProgress.find(p => p.userId === user.id && p.lessonId === les.id);

              return {
                id: les.id,
                title: les.title,
                description: les.description,
                position: les.position,
                durationSeconds: les.durationSeconds,
                hasVideo: !!les.videoFileName || !!les.playbackId,
                isFreePreview: les.isFreePreview,
                access: accessLes,
                isCompleted: progress?.isCompleted || false,
                progressPercent: progress?.progressPercent || 0,
                lastPositionSeconds: progress?.lastPositionSeconds || 0,
              };
            });

          return {
            id: top.id,
            title: top.title,
            description: top.description,
            position: top.position,
            lessons,
          };
        });

      return {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        position: mod.position,
        releaseType: mod.releaseType,
        releaseDays: mod.releaseDays,
        access: accessMod,
        topics,
      };
    });

  res.json({
    course: {
      id: mainCourse.id,
      title: mainCourse.title,
      description: mainCourse.description,
      thumbnailUrl: mainCourse.thumbnailUrl,
    },
    modules,
  });
});

// GET /api/student/lesson/:id
studentRouter.get('/lesson/:id', (req: Request & { auth?: any }, res: Response): void => {
  const user = req.auth.user as User;
  const { id } = req.params;
  const db = readDb();

  const lesson = db.lessons.find(l => l.id === id);
  if (!lesson) {
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }

  const access = canUserAccessLesson(user.id, lesson.id);
  if (!access.allowed) {
    res.status(403).json({
      error: 'Esta aula ainda não está liberada para seu plano ou período de acesso.',
      code: 'ACCESS_RESTRICTED',
      access,
    });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const streamTicket = generateStreamTicket(user.id, lesson.id, clientIp);

  const progress = db.lessonProgress.find(p => p.userId === user.id && p.lessonId === lesson.id);
  const mod = db.modules.find(m => m.id === lesson.moduleId);
  const top = db.topics.find(t => t.id === lesson.topicId);

  // Find previous and next accessible lessons in the canonical course/module/topic/lesson order.
  const allPublished = db.lessons.filter(l => l.status === 'PUBLISHED' && l.courseId === lesson.courseId)
    .sort((a, b) => {
      const modA = db.modules.find(m => m.id === a.moduleId)?.position || 0;
      const modB = db.modules.find(m => m.id === b.moduleId)?.position || 0;
      const topA = db.topics.find(t => t.id === a.topicId)?.position || 0;
      const topB = db.topics.find(t => t.id === b.topicId)?.position || 0;
      return modA - modB || topA - topB || a.position - b.position;
    }).filter(item => canUserAccessLesson(user.id, item.id).allowed);
  const currentIndex = allPublished.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? { id: allPublished[currentIndex - 1].id, title: allPublished[currentIndex - 1].title } : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allPublished.length - 1 ? { id: allPublished[currentIndex + 1].id, title: allPublished[currentIndex + 1].title } : null;

  // Dynamic anti-leak watermark payload
  const watermark = {
    enabled: db.systemSettings.watermarkEnabled,
    userName: user.name.toUpperCase(),
    userEmail: user.email,
    userMaskedEmail: maskEmail(user.email),
    accountId: `#${user.id.substring(user.id.length - 6).toUpperCase()}`,
    clientIp,
    cpf: user.cpf,
    timestamp: new Date().toLocaleDateString('pt-BR'),
    intervalSeconds: db.systemSettings.watermarkIntervalSeconds || 15,
  };

  res.json({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      durationSeconds: lesson.durationSeconds,
      hasVideo: Boolean(lesson.videoFileName || lesson.playbackId),
      supplementaryMaterials: lesson.supplementaryMaterials.map(({ storageFileName, ...material }) => material),
      module: { id: mod?.id, title: mod?.title },
      topic: { id: top?.id, title: top?.title },
      prevLesson,
      nextLesson,
    },
    stream: {
      streamUrl: `/api/stream/video/${streamTicket}`,
      ticket: streamTicket,
      provider: lesson.videoProvider,
    },
    watermark,
    telegram: {
      url: db.systemSettings.telegramGroupUrl || '',
      message: db.systemSettings.telegramHelpMessage || '',
      buttonLabel: db.systemSettings.telegramButtonLabel || '',
    },
    progress: {
      isCompleted: progress?.isCompleted || false,
      progressPercent: progress?.progressPercent || 0,
      lastPositionSeconds: progress?.lastPositionSeconds || 0,
    },
  });
});

// POST /api/student/progress
studentRouter.post('/progress', (req: Request & { auth?: any }, res: Response): void => {
  const user = req.auth.user as User;
  const { lessonId, positionSeconds, durationSeconds, manualCompleted, completionAction } = req.body;

  if (!lessonId) {
    res.status(400).json({ error: 'lessonId é obrigatório.' });
    return;
  }

  const db = readDb();
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }
  if (!canUserAccessLesson(user.id, lessonId).allowed) {
    res.status(403).json({ error: 'Você não possui acesso a esta aula.' }); return;
  }

  const duration = durationSeconds || lesson.durationSeconds || 600;
  const pos = Math.min(Math.max(0, Number(positionSeconds) || 0), Math.max(Number(durationSeconds) || lesson.durationSeconds || 600, 1));
  const calculatedPercent = Math.min(100, Math.round((pos / duration) * 100));

  const completionThreshold = db.systemSettings.completionThresholdPercent || 90;
  const requestedManualState = completionAction === 'MARK_COMPLETE' ? true : completionAction === 'MARK_INCOMPLETE' ? false : manualCompleted;
  const isCompleted = requestedManualState !== undefined ? Boolean(requestedManualState) : calculatedPercent >= completionThreshold;

  let progress = db.lessonProgress.find(p => p.userId === user.id && p.lessonId === lessonId);

  if (!progress) {
    progress = {
      id: `prog_${crypto.randomUUID()}`,
      userId: user.id,
      lessonId,
      progressPercent: calculatedPercent,
      lastPositionSeconds: pos,
      isCompleted,
      watchedSeconds: pos,
      accessCount: 1,
      lastWatchedAt: new Date().toISOString(),
    };
    db.lessonProgress.push(progress);
  } else {
    const previousPosition = progress.lastPositionSeconds;
    progress.lastPositionSeconds = pos;
    progress.progressPercent = Math.max(progress.progressPercent, calculatedPercent);
    if (completionAction === 'MARK_INCOMPLETE' || manualCompleted === false) progress.isCompleted = false;
    else if (isCompleted) progress.isCompleted = true;
    progress.watchedSeconds += Math.max(0, pos - previousPosition);
    progress.lastWatchedAt = new Date().toISOString();
  }

  writeDb(db);

  res.json({
    message: 'Progresso salvo com sucesso.',
    progress: {
      lessonId,
      progressPercent: progress.progressPercent,
      lastPositionSeconds: progress.lastPositionSeconds,
      isCompleted: progress.isCompleted,
    },
  });
});
