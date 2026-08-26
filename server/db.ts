import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadPostgresState, persistPostgresState, waitForPostgresPersistence } from './postgres.js';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STUDENT';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'BLOCKED';
  startDate: string; // ISO date string (basis for 7-day release rule)
  expirationDate: string; // ISO date string
  firstAccessAt: string | null;
  lastAccessAt: string | null;
  forcePasswordChange: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  isActive: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  releaseType: 'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL';
  releaseDays: number; // e.g. 7 for the 7-day rule
  releaseDate: string | null;
  status: 'PUBLISHED' | 'DRAFT';
}

export interface Topic {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  position: number;
}

export interface SupplementaryMaterial {
  id: string;
  title: string;
  type: 'PDF' | 'LINK' | 'DOCUMENT';
  url: string;
  sizeBytes?: number;
  storageFileName?: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  durationSeconds: number;
  videoFileName: string | null;
  videoSizeBytes?: number;
  videoUploadedAt?: string | null;
  videoProvider: 'LOCAL_SECURE' | 'EXTERNAL_HLS' | 'CLOUDFLARE_STREAM';
  playbackId?: string;
  supplementaryMaterials: SupplementaryMaterial[];
  practicalVideos?: PracticalVideo[];
  imageExercises?: ImageExercise[];
  releaseType: 'INHERIT' | 'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL';
  releaseDays: number;
  releaseDate: string | null;
  isFreePreview: boolean;
  status: 'PUBLISHED' | 'DRAFT';
}

export interface PracticalVideo {
  id: string;
  title: string;
  description: string;
  position: number;
  videoFileName: string;
  sizeBytes: number;
  durationSeconds: number;
  uploadedAt: string;
}

export interface ImageAsset {
  storageFileName: string;
  originalName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  uploadedAt: string;
}

export interface ImageExercise {
  id: string;
  title: string;
  description: string;
  position: number;
  original: ImageAsset;
  corrected?: ImageAsset;
}

export interface UserContentOverride {
  id: string;
  userId: string;
  contentType: 'COURSE' | 'MODULE' | 'LESSON';
  contentId: string;
  action: 'ALLOW' | 'DENY';
  reason?: string;
  grantedBy: string;
  createdAt: string;
}

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  progressPercent: number;
  lastPositionSeconds: number;
  isCompleted: boolean;
  watchedSeconds: number;
  accessCount: number;
  lastWatchedAt: string;
  mainVideoEndedAt?: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface SystemSettings {
  id: string;
  platformName: string;
  supportEmail: string;
  defaultAccessMonths: number;
  progressiveReleaseDays: number; // default 7
  completionThresholdPercent: number; // default 90
  singleSessionPolicy: 'TERMINATE_OLD_LOGIN' | 'BLOCK_NEW_LOGIN';
  watermarkEnabled: boolean;
  watermarkIntervalSeconds: number;
  brandTagline: string;
  noticeBanner: string | null;
  telegramGroupUrl?: string;
  telegramHelpMessage?: string;
  telegramButtonLabel?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    from: string;
    encryptedPassword?: string;
    passwordConfigured: boolean;
    lastTestAt?: string;
    lastTestStatus?: 'SUCCESS' | 'FAILED';
  };
}

export interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  courses: Course[];
  modules: Module[];
  topics: Topic[];
  lessons: Lesson[];
  userContentOverrides: UserContentOverride[];
  lessonProgress: LessonProgress[];
  auditLogs: AuditLog[];
  passwordResetTokens: PasswordResetToken[];
  systemSettings: SystemSettings;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const VIDEO_DIR = path.join(DATA_DIR, 'videos');
const MATERIAL_DIR = path.join(DATA_DIR, 'materials');
const LESSON_MEDIA_DIR = path.join(DATA_DIR, 'lesson-media');
const UPLOAD_TMP_DIR = path.join(DATA_DIR, 'uploads');
let databaseCache: DatabaseSchema | null = null;

export function initDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
  }
  if (!fs.existsSync(MATERIAL_DIR)) fs.mkdirSync(MATERIAL_DIR, { recursive: true });
  if (!fs.existsSync(LESSON_MEDIA_DIR)) fs.mkdirSync(LESSON_MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_TMP_DIR)) fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
  for (const entry of fs.readdirSync(UPLOAD_TMP_DIR)) {
    const filePath = path.join(UPLOAD_TMP_DIR, entry);
    try {
      if (Date.now() - fs.statSync(filePath).mtimeMs > 24 * 60 * 60 * 1000) fs.unlinkSync(filePath);
    } catch { /* a concurrent upload may disappear between stat and cleanup */ }
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialData: DatabaseSchema = {
      users: [],
      sessions: [],
      courses: [],
      modules: [],
      topics: [],
      lessons: [],
      userContentOverrides: [],
      lessonProgress: [],
      auditLogs: [],
      passwordResetTokens: [],
      systemSettings: {
        id: 'settings-default',
        platformName: 'Mentoria A Mecânica — Trader Thiago',
        supportEmail: 'suporte@mentoriaamecanica.com',
        defaultAccessMonths: 12,
        progressiveReleaseDays: 7,
        completionThresholdPercent: 90,
        singleSessionPolicy: 'TERMINATE_OLD_LOGIN',
        watermarkEnabled: true,
        watermarkIntervalSeconds: 15,
        brandTagline: 'Estratégia • Disciplina • Consistência • Resultados',
        noticeBanner: null,
        telegramGroupUrl: '',
        telegramHelpMessage: 'Ficou com alguma dúvida sobre esta aula? Entre no grupo e fale com a equipe.',
        telegramButtonLabel: 'Entrar no grupo do Telegram',
        smtp: {
          host: process.env.SMTP_HOST || '',
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
          username: process.env.SMTP_USER || '',
          from: process.env.SMTP_FROM || 'Mentoria A Mecânica <no-reply@localhost>',
          passwordConfigured: Boolean(process.env.SMTP_PASSWORD),
        },
      },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

export function readDb(): DatabaseSchema {
  if (databaseCache) return databaseCache;
  initDatabase();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    databaseCache = normalizeDatabase(JSON.parse(raw) as DatabaseSchema);
    return databaseCache;
  } catch (err) {
    console.error('Error reading database file, returning default structure:', err);
    databaseCache = {
      users: [],
      sessions: [],
      courses: [],
      modules: [],
      topics: [],
      lessons: [],
      userContentOverrides: [],
      lessonProgress: [],
      auditLogs: [],
      passwordResetTokens: [],
      systemSettings: {
        id: 'settings-default',
        platformName: 'Mentoria A Mecânica — Trader Thiago',
        supportEmail: 'suporte@mentoriaamecanica.com',
        defaultAccessMonths: 12,
        progressiveReleaseDays: 7,
        completionThresholdPercent: 90,
        singleSessionPolicy: 'TERMINATE_OLD_LOGIN',
        watermarkEnabled: true,
        watermarkIntervalSeconds: 15,
        brandTagline: 'Estratégia • Disciplina • Consistência • Resultados',
        noticeBanner: null,
        telegramGroupUrl: '',
        telegramHelpMessage: 'Ficou com alguma dúvida sobre esta aula? Entre no grupo e fale com a equipe.',
        telegramButtonLabel: 'Entrar no grupo do Telegram',
        smtp: {
          host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', username: process.env.SMTP_USER || '', from: process.env.SMTP_FROM || 'Mentoria A Mecânica <no-reply@localhost>', passwordConfigured: Boolean(process.env.SMTP_PASSWORD),
        },
      },
    };
    return databaseCache;
  }
}

export async function hydrateDatabaseFromPostgres(): Promise<void> {
  const state = await loadPostgresState();
  if (state) databaseCache = normalizeDatabase(state);
}

function normalizeDatabase(data: DatabaseSchema): DatabaseSchema {
  const settings = data.systemSettings || ({} as SystemSettings);
  data.systemSettings = {
    ...settings,
    id: settings.id || 'settings-default',
    telegramGroupUrl: settings.telegramGroupUrl || '',
    telegramHelpMessage: settings.telegramHelpMessage || 'Ficou com alguma dúvida sobre esta aula? Entre no grupo e fale com a equipe.',
    telegramButtonLabel: settings.telegramButtonLabel || 'Entrar no grupo do Telegram',
  };
  for (const lesson of data.lessons || []) {
    lesson.practicalVideos = Array.isArray(lesson.practicalVideos) ? lesson.practicalVideos : [];
    lesson.imageExercises = Array.isArray(lesson.imageExercises) ? lesson.imageExercises : [];
  }
  // Students already marked as complete in the previous model keep their
  // complementary media access after this upgrade.
  for (const progress of data.lessonProgress || []) {
    if (progress.isCompleted && progress.mainVideoEndedAt === undefined) {
      progress.mainVideoEndedAt = progress.lastWatchedAt || new Date().toISOString();
    }
  }
  return data;
}

export function writeDb(data: DatabaseSchema): void {
  initDatabase();
  databaseCache = data;
  const tempFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  persistPostgresState(data);
}

export async function writeDbAndWait(data: DatabaseSchema): Promise<void> {
  writeDb(data);
  await waitForPostgresPersistence();
}

export { DATA_DIR, VIDEO_DIR, MATERIAL_DIR, LESSON_MEDIA_DIR, UPLOAD_TMP_DIR, DB_FILE };
