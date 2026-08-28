import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { readDb, writeDb, writeDbAndWait, User, Course, Module, Topic, Lesson, UserContentOverride, VIDEO_DIR, MATERIAL_DIR, LESSON_MEDIA_DIR, STUDENT_NOTES_DIR, UPLOAD_TMP_DIR, ImageAsset, StudentLessonNote } from '../db.js';
import { requireAdmin, hashPassword, generateRandomPassword } from '../auth.js';
import { logAudit } from '../audit.js';
import { sendSmtpTestEmail, sendWelcomeEmail } from '../email.js';
import { encryptSecret } from '../secrets.js';

export const adminRouter = Router();

function onlyDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpf(value: string): boolean {
  if (!value) return true;
  if (value.length !== 11 || /^(\d)\1+$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(value[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(value[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(value[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(value[10]);
}

function requireSuperAdmin(req: Request & { auth?: any }, res: Response): boolean {
  if (req.auth?.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Somente o super administrador pode executar esta operação.' });
    return false;
  }
  return true;
}

function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

// Require admin authentication for all routes
adminRouter.use(requireAdmin);

// Configure multer for secure video and material uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `vid_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const isMp4Name = path.extname(file.originalname).toLowerCase() === '.mp4';
    const allowed = isMp4Name && ['video/mp4', 'application/octet-stream'].includes(file.mimetype);
    if (!allowed) { cb(new Error('Envie somente um arquivo MP4 válido.')); return; }
    cb(null, true);
  },
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit for videos
});

const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MATERIAL_DIR),
    filename: (_req, file, cb) => cb(null, `mat_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const imageUpload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, UPLOAD_TMP_DIR), filename: (_req, file, cb) => cb(null, `img_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`) }),
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function removeLessonVideo(lesson: Lesson): void {
  if (!lesson.videoFileName) return;
  const filePath = path.join(VIDEO_DIR, lesson.videoFileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function removeLessonMaterials(lesson: Lesson): void {
  for (const material of lesson.supplementaryMaterials || []) {
    if (!material.storageFileName) continue;
    const filePath = path.join(MATERIAL_DIR, path.basename(material.storageFileName));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function removeLessonMedia(lesson: Lesson): void {
  for (const video of lesson.practicalVideos || []) {
    const filePath = path.join(VIDEO_DIR, path.basename(video.videoFileName)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  for (const exercise of lesson.imageExercises || []) {
    for (const asset of [exercise.original, exercise.corrected].filter(Boolean) as ImageAsset[]) {
      const filePath = path.join(LESSON_MEDIA_DIR, path.basename(asset.storageFileName)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
}

function removeStudentLessonNotes(db: ReturnType<typeof readDb>, predicate: (note: StudentLessonNote) => boolean): void {
  const removed = db.studentLessonNotes.filter(predicate);
  for (const note of removed) {
    for (const image of note.images || []) {
      const filePath = path.join(STUDENT_NOTES_DIR, path.basename(image.storageFileName));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
  db.studentLessonNotes = db.studentLessonNotes.filter(note => !predicate(note));
}

function removeLessonsAndRelatedData(db: ReturnType<typeof readDb>, lessonIds: string[]): void {
  const idSet = new Set(lessonIds);
  db.lessons.filter(lesson => idSet.has(lesson.id)).forEach(lesson => { removeLessonVideo(lesson); removeLessonMaterials(lesson); removeLessonMedia(lesson); });
  db.lessons = db.lessons.filter(lesson => !idSet.has(lesson.id));
  db.lessonProgress = db.lessonProgress.filter(progress => !idSet.has(progress.lessonId));
  removeStudentLessonNotes(db, note => idSet.has(note.lessonId));
  db.userContentOverrides = db.userContentOverrides.filter(override => !(override.contentType === 'LESSON' && idSet.has(override.contentId)));
}

function isMp4File(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const bytes = fs.readSync(fd, header, 0, header.length, 0);
    return bytes >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp';
  } finally { fs.closeSync(fd); }
}

function imageMimeFromSignature(filePath: string): ImageAsset['mimeType'] | null {
  const buffer = fs.readFileSync(filePath).subarray(0, 16);
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function savePrivateImage(file: Express.Multer.File): ImageAsset {
  const mimeType = imageMimeFromSignature(file.path);
  if (!mimeType) throw new Error('Imagem inválida. Envie JPEG, PNG ou WebP válido.');
  const storageFileName = `lesson_${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
  const finalPath = path.join(LESSON_MEDIA_DIR, storageFileName);
  fs.renameSync(file.path, finalPath);
  return { storageFileName, originalName: file.originalname, mimeType, sizeBytes: fs.statSync(finalPath).size, uploadedAt: new Date().toISOString() };
}

function runMediaCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(error));
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `${command} terminou com código ${code}.`)));
  });
}

async function inspectMp4(filePath: string): Promise<void> {
  const output = await runMediaCommand('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name:stream=codec_type,codec_name', '-of', 'json', filePath]);
  const info = JSON.parse(output) as { format?: { format_name?: string }; streams?: Array<{ codec_type?: string; codec_name?: string }> };
  const format = info.format?.format_name || '';
  const videoCodec = info.streams?.find(stream => stream.codec_type === 'video')?.codec_name;
  const audioCodec = info.streams?.find(stream => stream.codec_type === 'audio')?.codec_name;
  if (!format.includes('mp4') || videoCodec !== 'h264' || (audioCodec && audioCodec !== 'aac')) {
    throw new Error('Formato incompatível. Envie MP4 com vídeo H.264 e áudio AAC para reprodução web.');
  }
}

async function optimizeMp4(sourcePath: string, finalPath: string): Promise<void> {
  await inspectMp4(sourcePath);
  const temporaryPath = `${finalPath}.optimizing-${crypto.randomBytes(6).toString('hex')}.mp4`;
  try {
    await runMediaCommand('ffmpeg', ['-y', '-v', 'error', '-i', sourcePath, '-map', '0', '-c', 'copy', '-movflags', '+faststart', temporaryPath]);
    await inspectMp4(temporaryPath);
    if (!fs.existsSync(temporaryPath) || fs.statSync(temporaryPath).size === 0) throw new Error('O arquivo otimizado ficou vazio.');
    fs.renameSync(temporaryPath, finalPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

// GET /api/admin/metrics
adminRouter.get('/metrics', (req: Request, res: Response): void => {
  const db = readDb();
  const totalUsers = db.users.filter(u => u.role === 'STUDENT').length;
  const activeUsers = db.users.filter(u => u.role === 'STUDENT' && u.status === 'ACTIVE').length;
  const suspendedUsers = db.users.filter(u => u.role === 'STUDENT' && u.status === 'SUSPENDED').length;
  const expiredUsers = db.users.filter(u => u.role === 'STUDENT' && u.status === 'EXPIRED').length;
  const blockedUsers = db.users.filter(u => u.role === 'STUDENT' && u.status === 'BLOCKED').length;
  const activeSessions = db.sessions.filter(s => s.isActive).length;

  const totalLessons = db.lessons.filter(l => l.status === 'PUBLISHED').length;
  const totalVideos = db.lessons.filter(l => l.status === 'PUBLISHED' && Boolean(l.videoFileName || l.playbackId)).length;
  const totalModules = db.modules.filter(m => m.status === 'PUBLISHED').length;
  const totalProgressRecords = db.lessonProgress.length;
  const completedLessons = db.lessonProgress.filter(p => p.isCompleted).length;

  res.json({
    totalStudents: totalUsers,
    activeStudents: activeUsers,
    expiredStudents: expiredUsers,
    suspendedStudents: suspendedUsers,
    activeSessions,
    totalModules,
    totalLessons,
    totalVideos,
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      expired: expiredUsers,
      blocked: blockedUsers,
    },
    sessions: {
      active: activeSessions,
    },
    content: {
      totalModules,
      totalLessons,
      totalProgressRecords,
      completedLessons,
    },
  });
});

// GET /api/admin/users
adminRouter.get('/users', (req: Request, res: Response): void => {
  const { search, status, page = '1', limit = '50' } = req.query;
  const db = readDb();

  let list = db.users.filter(u => u.role === 'STUDENT');

  if (status && typeof status === 'string' && status !== 'ALL') {
    list = list.filter(u => u.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }

  // Calculate dynamic data for each student
  const totalCount = list.length;
  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 50;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = list.slice(startIndex, startIndex + limitNum);

  const publishedLessons = db.lessons.filter(l => l.status === 'PUBLISHED');

  const usersWithMeta = paginated.map(user => {
    const activeSession = db.sessions.find(s => s.userId === user.id && s.isActive);
    const overrides = db.userContentOverrides.filter(o => o.userId === user.id);
    const hasGlobalAllow = overrides.some(o => o.contentType === 'COURSE' && o.action === 'ALLOW');

    const userProgress = db.lessonProgress.filter(p => p.userId === user.id);
    const completedCount = userProgress.filter(p => p.isCompleted).length;
    const progressPercent = publishedLessons.length > 0 ? Math.round((completedCount / publishedLessons.length) * 100) : 0;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf,
      role: user.role,
      status: user.status,
      startDate: user.startDate,
      expirationDate: user.expirationDate,
      firstAccessAt: user.firstAccessAt,
      lastAccessAt: user.lastAccessAt,
      hasActiveSession: !!activeSession,
      activeSessionInfo: activeSession ? { device: activeSession.deviceInfo, ip: activeSession.ipAddress, lastActivity: activeSession.lastActivityAt } : null,
      hasGlobalOverride: hasGlobalAllow,
      progressPercent,
      completedLessons: completedCount,
      notes: user.notes,
      createdAt: user.createdAt,
    };
  });

  res.json({
    users: usersWithMeta,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    },
  });
});

// GET /api/admin/admins
adminRouter.get('/admins', (req: Request & { auth?: any }, res: Response): void => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  res.json({ admins: db.users.filter(user => user.role === 'SUPER_ADMIN' || user.role === 'ADMIN').map(publicUser) });
});

// POST /api/admin/admins
adminRouter.post('/admins', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const { name, email, phone, password, autoGeneratePassword = true, status = 'ACTIVE' } = req.body;
  if (!name || !email) { res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' }); return; }
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = onlyDigits(phone);
  if (normalizedPhone && ![10, 11].includes(normalizedPhone.length)) { res.status(400).json({ error: 'Telefone inválido. Informe DDD e número.' }); return; }
  const db = readDb();
  if (db.users.some(user => user.email.toLowerCase() === normalizedEmail)) { res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' }); return; }
  let finalPassword = String(password || '');
  if (autoGeneratePassword || !finalPassword) finalPassword = generateRandomPassword(12);
  if (finalPassword.length < 8) { res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' }); return; }
  const now = new Date();
  const newAdmin: User = {
    id: `usr_${crypto.randomUUID()}`,
    name: String(name).trim(), email: normalizedEmail, phone: normalizedPhone || undefined,
    passwordHash: hashPassword(finalPassword), role: 'ADMIN', status: status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    startDate: now.toISOString(), expirationDate: '2099-12-31T23:59:59.999Z', firstAccessAt: null, lastAccessAt: null,
    forcePasswordChange: true, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  db.users.push(newAdmin);
  await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'CREATE_ADMIN', entityType: 'USER', entityId: newAdmin.id, details: { name: newAdmin.name, email: newAdmin.email } });
  void sendWelcomeEmail(newAdmin.email, newAdmin.name, finalPassword).catch(error => console.error('Falha ao enviar e-mail de boas-vindas do admin:', error));
  res.status(201).json({ message: 'Administrador criado com sucesso.', admin: publicUser(newAdmin), temporaryPassword: finalPassword });
});

// PUT /api/admin/admins/:id
adminRouter.put('/admins/:id', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  const admin = db.users.find(user => user.id === req.params.id && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'));
  if (!admin) { res.status(404).json({ error: 'Administrador não encontrado.' }); return; }
  const { name, email, phone, status } = req.body;
  if (admin.role === 'SUPER_ADMIN' && status === 'BLOCKED') {
    const activeSupers = db.users.filter(user => user.role === 'SUPER_ADMIN' && user.status !== 'BLOCKED').length;
    if (activeSupers <= 1) { res.status(400).json({ error: 'O último super administrador não pode ser bloqueado.' }); return; }
  }
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some(user => user.id !== admin.id && user.email.toLowerCase() === normalizedEmail)) { res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' }); return; }
    admin.email = normalizedEmail;
  }
  if (name !== undefined) admin.name = String(name).trim();
  if (phone !== undefined) admin.phone = onlyDigits(phone) || undefined;
  if (status !== undefined && ['ACTIVE', 'BLOCKED'].includes(status)) admin.status = status;
  admin.updatedAt = new Date().toISOString();
  await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'UPDATE_ADMIN', entityType: 'USER', entityId: admin.id, details: { name: admin.name, email: admin.email, status: admin.status } });
  res.json({ message: 'Administrador atualizado com sucesso.', admin: publicUser(admin) });
});

// DELETE /api/admin/admins/:id
adminRouter.delete('/admins/:id', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  const index = db.users.findIndex(user => user.id === req.params.id && user.role === 'ADMIN');
  if (index < 0) {
    const target = db.users.find(user => user.id === req.params.id);
    res.status(target?.role === 'SUPER_ADMIN' ? 400 : 404).json({ error: target?.role === 'SUPER_ADMIN' ? 'O super administrador não pode ser excluído.' : 'Administrador não encontrado.' });
    return;
  }
  const [removed] = db.users.splice(index, 1);
  db.sessions = db.sessions.filter(session => session.userId !== removed.id);
  db.passwordResetTokens = db.passwordResetTokens.filter(token => token.userId !== removed.id);
  db.lessonProgress = db.lessonProgress.filter(progress => progress.userId !== removed.id);
  db.userContentOverrides = db.userContentOverrides.filter(override => override.userId !== removed.id);
  await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'DELETE_ADMIN', entityType: 'USER', entityId: removed.id, details: { email: removed.email } });
  res.json({ message: 'Administrador excluído com sucesso.' });
});

// POST /api/admin/admins/:id/reset-password
adminRouter.post('/admins/:id/reset-password', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  const admin = db.users.find(user => user.id === req.params.id && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'));
  if (!admin) { res.status(404).json({ error: 'Administrador não encontrado.' }); return; }
  const password = generateRandomPassword(12);
  admin.passwordHash = hashPassword(password); admin.forcePasswordChange = true; admin.updatedAt = new Date().toISOString();
  for (const session of db.sessions.filter(item => item.userId === admin.id && item.isActive)) { session.isActive = false; session.revokedAt = new Date().toISOString(); session.revokedReason = 'SENHA_REDEFINIDA_PELO_SUPER_ADMIN'; }
  await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'RESET_ADMIN_PASSWORD', entityType: 'USER', entityId: admin.id });
  void sendWelcomeEmail(admin.email, admin.name, password).catch(error => console.error('Falha ao enviar reset do admin:', error));
  res.json({ message: 'Senha redefinida com sucesso.', temporaryPassword: password });
});

// POST /api/admin/admins/:id/revoke-session
adminRouter.post('/admins/:id/revoke-session', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  const admin = db.users.find(user => user.id === req.params.id && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'));
  if (!admin) { res.status(404).json({ error: 'Administrador não encontrado.' }); return; }
  let count = 0;
  for (const session of db.sessions.filter(item => item.userId === admin.id && item.isActive)) { session.isActive = false; session.revokedAt = new Date().toISOString(); session.revokedReason = 'REVOGADA_PELO_SUPER_ADMIN'; count++; }
  await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'REVOKE_ADMIN_SESSION', entityType: 'USER', entityId: admin.id, details: { sessionsClosed: count } });
  res.json({ message: 'Sessão do administrador revogada.', sessionsClosed: count });
});

// GET /api/admin/users/:id (student detail)
adminRouter.get('/users/:id', (req: Request, res: Response): void => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id && u.role === 'STUDENT');
  if (!user) {
    res.status(404).json({ error: 'Aluno não encontrado.' });
    return;
  }
  const activeSession = db.sessions.find(s => s.userId === user.id && s.isActive);
  res.json({
    user: { ...user, passwordHash: undefined },
    overrides: db.userContentOverrides.filter(o => o.userId === user.id),
    progress: db.lessonProgress.filter(p => p.userId === user.id),
    activeSession: activeSession ? {
      id: activeSession.id, userId: user.id, userName: user.name, userEmail: user.email,
      ipAddress: activeSession.ipAddress, device: activeSession.deviceInfo,
      createdAt: activeSession.createdAt, lastActivityAt: activeSession.lastActivityAt,
    } : null,
  });
});

// POST /api/admin/users (Create new student)
adminRouter.post('/users', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const { name, email, phone, cpf, password, autoGeneratePassword, durationMonths = 12, startDate, unlockAllImmediately, notes } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = onlyDigits(phone);
  const normalizedCpf = onlyDigits(cpf);
  if (normalizedPhone && ![10, 11].includes(normalizedPhone.length)) {
    res.status(400).json({ error: 'Telefone inválido. Informe DDD e número.' });
    return;
  }
  if (normalizedCpf && !isValidCpf(normalizedCpf)) {
    res.status(400).json({ error: 'CPF inválido.' });
    return;
  }
  const db = readDb();

  const existing = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    return;
  }
  if (normalizedCpf && db.users.some(u => u.cpf === normalizedCpf)) {
    res.status(409).json({ error: 'Já existe um usuário cadastrado com este CPF.' });
    return;
  }

  let finalPassword = password;
  let generatedRandom = false;

  if (!autoGeneratePassword && finalPassword && String(finalPassword).length < 8) {
    res.status(400).json({ error: 'A senha personalizada deve ter no mínimo 8 caracteres.' });
    return;
  }

  if (autoGeneratePassword || !finalPassword) {
    finalPassword = generateRandomPassword(12);
    generatedRandom = true;
  }

  const now = new Date();
  const start = startDate ? new Date(startDate) : now;
  const expDate = new Date(start.getTime() + (Number(durationMonths) || 12) * 30 * 24 * 60 * 60 * 1000);

  const newUser: User = {
    id: `usr_${crypto.randomUUID()}`,
    name: String(name).trim(),
    email: normalizedEmail,
    phone: normalizedPhone || undefined,
    cpf: normalizedCpf || undefined,
    passwordHash: hashPassword(finalPassword),
    role: 'STUDENT',
    status: 'ACTIVE',
    startDate: start.toISOString(),
    expirationDate: expDate.toISOString(),
    firstAccessAt: null,
    lastAccessAt: null,
    forcePasswordChange: true,
    notes: notes ? String(notes).trim() : undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  db.users.push(newUser);

  // If unlockAllImmediately was checked, create a global course ALLOW override
  if (unlockAllImmediately) {
    const mainCourse = db.courses[0];
    if (mainCourse) {
      const override: UserContentOverride = {
        id: `ovr_${crypto.randomUUID()}`,
        userId: newUser.id,
        contentType: 'COURSE',
        contentId: mainCourse.id,
        action: 'ALLOW',
        reason: 'Liberação total concedida no cadastro manual pelo administrador.',
        grantedBy: req.auth.user.id,
        createdAt: now.toISOString(),
      };
      db.userContentOverrides.push(override);
    }
  }

  try {
    await writeDbAndWait(db);
  } catch {
    res.status(503).json({ error: 'Não foi possível confirmar o cadastro no banco de dados.' });
    return;
  }

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'CREATE_STUDENT',
    entityType: 'USER',
    entityId: newUser.id,
    details: { name: newUser.name, email: newUser.email, durationMonths, unlockAllImmediately },
  });
  // O cadastro já foi confirmado no PostgreSQL. O envio de e-mail não pode
  // bloquear a resposta caso o SMTP esteja lento ou indisponível.
  void sendWelcomeEmail(newUser.email, newUser.name, finalPassword).catch(error => {
    console.error('Falha ao enviar e-mail de boas-vindas:', error);
  });

  res.status(201).json({
    message: 'Aluno criado com sucesso.',
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      cpf: newUser.cpf,
      startDate: newUser.startDate,
      expirationDate: newUser.expirationDate,
      status: newUser.status,
    },
    generatedPassword: finalPassword,
    temporaryPassword: finalPassword,
    emailSimulation: {
      to: newUser.email,
      subject: 'Seu acesso à Mentoria A Mecânica foi criado',
      temporaryPassword: finalPassword,
    },
  });
});

// PUT /api/admin/users/:id
adminRouter.put('/users/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { name, email, phone, cpf, status, startDate, expirationDate, notes } = req.body;

  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  if (name) user.name = String(name).trim();
  if (email) {
    const normalized = String(email).trim().toLowerCase();
    const existing = db.users.find(u => u.email.toLowerCase() === normalized && u.id !== id);
    if (existing) {
      res.status(409).json({ error: 'Outro usuário já utiliza este e-mail.' });
      return;
    }
    user.email = normalized;
  }
  if (phone !== undefined) {
    const normalizedPhone = onlyDigits(phone);
    if (normalizedPhone && ![10, 11].includes(normalizedPhone.length)) {
      res.status(400).json({ error: 'Telefone inválido.' });
      return;
    }
    user.phone = normalizedPhone || undefined;
  }
  if (cpf !== undefined) {
    const normalizedCpf = onlyDigits(cpf);
    if (normalizedCpf && !isValidCpf(normalizedCpf)) {
      res.status(400).json({ error: 'CPF inválido.' });
      return;
    }
    const duplicateCpf = db.users.find(u => u.cpf === normalizedCpf && u.id !== id);
    if (normalizedCpf && duplicateCpf) {
      res.status(409).json({ error: 'Outro usuário já utiliza este CPF.' });
      return;
    }
    user.cpf = normalizedCpf || undefined;
  }
  if (status) user.status = status;
  if (startDate) user.startDate = new Date(startDate).toISOString();
  if (expirationDate) user.expirationDate = new Date(expirationDate).toISOString();
  if (notes !== undefined) user.notes = String(notes).trim();
  user.updatedAt = new Date().toISOString();

  // If status is SUSPENDED or BLOCKED, revoke active sessions
  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
    for (const s of db.sessions) {
      if (s.userId === user.id && s.isActive) {
        s.isActive = false;
        s.revokedAt = new Date().toISOString();
        s.revokedReason = `STATUS_ALTERADO_PARA_${user.status}`;
      }
    }
  }

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'UPDATE_STUDENT',
    entityType: 'USER',
    entityId: user.id,
    details: { changes: req.body },
  });

  res.json({ message: 'Dados do aluno atualizados com sucesso.', user });
});

adminRouter.delete('/users/:id', (req: Request & { auth?: any }, res: Response): void => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id && u.role === 'STUDENT');
  if (!user) { res.status(404).json({ error: 'Aluno não encontrado.' }); return; }
  db.users = db.users.filter(u => u.id !== user.id);
  db.sessions = db.sessions.filter(s => s.userId !== user.id);
  db.lessonProgress = db.lessonProgress.filter(p => p.userId !== user.id);
  db.userContentOverrides = db.userContentOverrides.filter(o => o.userId !== user.id);
  db.passwordResetTokens = db.passwordResetTokens.filter(t => t.userId !== user.id);
  removeStudentLessonNotes(db, note => note.userId === user.id);
  writeDb(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'DELETE_STUDENT', entityType: 'USER', entityId: user.id, details: { email: user.email } });
  res.json({ message: 'Aluno removido com sucesso.' });
});

// POST /api/admin/users/:id/override-all (Instant unlock / restore 7-day rule)
adminRouter.post('/users/:id/override-all', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { action } = req.body; // 'UNLOCK_ALL' or 'RESTORE_RULES'

  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  const mainCourse = db.courses[0];
  if (!mainCourse) {
    res.status(404).json({ error: 'Curso não encontrado.' });
    return;
  }

  if (action === 'UNLOCK_ALL') {
    // Remove existing denies
    db.userContentOverrides = db.userContentOverrides.filter(o => !(o.userId === id && o.contentType === 'COURSE'));
    db.userContentOverrides.push({
      id: `ovr_${crypto.randomUUID()}`,
      userId: id,
      contentType: 'COURSE',
      contentId: mainCourse.id,
      action: 'ALLOW',
      reason: 'Liberação total de todos os conteúdos concedida manualmente pelo administrador.',
      grantedBy: req.auth.user.id,
      createdAt: new Date().toISOString(),
    });

    logAudit({
      actorId: req.auth.user.id,
      actorName: req.auth.user.name,
      actorRole: req.auth.user.role,
      action: 'MANUAL_UNLOCK_ALL',
      entityType: 'USER',
      entityId: id,
      details: { studentName: user.name },
    });

    writeDb(db);
    res.json({ message: 'Todos os conteúdos foram liberados imediatamente para este aluno.' });
  } else {
    // RESTORE_RULES
    db.userContentOverrides = db.userContentOverrides.filter(o => !(o.userId === id && o.contentType === 'COURSE' && o.action === 'ALLOW'));
    
    logAudit({
      actorId: req.auth.user.id,
      actorName: req.auth.user.name,
      actorRole: req.auth.user.role,
      action: 'RESTORE_AUTOMATIC_RULES',
      entityType: 'USER',
      entityId: id,
      details: { studentName: user.name },
    });

    writeDb(db);
    res.json({ message: 'Regras automáticas normais (7 dias) restauradas para este aluno.' });
  }
});

// POST /api/admin/users/:id/override-item (ALLOW / DENY single module or lesson)
adminRouter.post('/users/:id/override-item', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { contentType, contentId, action } = req.body; // action: 'ALLOW' | 'DENY' | 'REMOVE'

  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  // Remove previous override for this item
  db.userContentOverrides = db.userContentOverrides.filter(o => !(o.userId === id && o.contentType === contentType && o.contentId === contentId));

  if (action === 'ALLOW' || action === 'DENY') {
    db.userContentOverrides.push({
      id: `ovr_${crypto.randomUUID()}`,
      userId: id,
      contentType,
      contentId,
      action,
      reason: `Exceção manual ${action} configurada pelo administrador.`,
      grantedBy: req.auth.user.id,
      createdAt: new Date().toISOString(),
    });
  }

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: `MANUAL_OVERRIDE_${action}`,
    entityType: contentType,
    entityId: contentId,
    details: { studentId: id, studentName: user.name, action },
  });

  res.json({ message: 'Regra individual atualizada com sucesso.' });
});

// POST /api/admin/users/:id/revoke-session (Force disconnect student)
adminRouter.post('/users/:id/revoke-session', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const db = readDb();
  const user = db.users.find(u => u.id === id);

  let count = 0;
  for (const s of db.sessions) {
    if (s.userId === id && s.isActive) {
      s.isActive = false;
      s.revokedAt = new Date().toISOString();
      s.revokedReason = 'ENCERRADA_PELO_ADMINISTRADOR';
      count++;
    }
  }

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'FORCE_DISCONNECT_SESSION',
    entityType: 'USER',
    entityId: id,
    details: { studentName: user?.name, sessionsClosed: count },
  });

  res.json({ message: `${count} sessão(ões) ativa(s) do aluno foram desconectadas.` });
});

// POST /api/admin/users/:id/reset-password
adminRouter.post('/users/:id/reset-password', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { newPassword, autoGenerate } = req.body;

  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  let finalPassword = newPassword;
  if (autoGenerate || !finalPassword) {
    finalPassword = generateRandomPassword(12);
  }

  user.passwordHash = hashPassword(finalPassword);
  user.forcePasswordChange = true;
  user.updatedAt = new Date().toISOString();

  // Invalidate active sessions
  for (const s of db.sessions) {
    if (s.userId === user.id && s.isActive) {
      s.isActive = false;
      s.revokedAt = new Date().toISOString();
      s.revokedReason = 'SENHA_REDEFINIDA_PELO_ADMIN';
    }
  }

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'ADMIN_RESET_PASSWORD',
    entityType: 'USER',
    entityId: user.id,
    details: { studentName: user.name },
  });

  res.json({
    message: 'Senha do aluno redefinida com sucesso.',
    temporaryPassword: finalPassword,
  });
});

// GET /api/admin/courses (Full management tree)
adminRouter.post('/courses', (req: Request & { auth?: any }, res: Response): void => {
  const { title, description = '', thumbnailUrl = '', status = 'DRAFT' } = req.body;
  if (!title || !String(title).trim()) { res.status(400).json({ error: 'Título do curso é obrigatório.' }); return; }
  const db = readDb();
  const now = new Date().toISOString();
  const course: Course = { id: `crs_${crypto.randomUUID()}`, title: String(title).trim(), description: String(description), thumbnailUrl: String(thumbnailUrl), status, createdAt: now, updatedAt: now };
  db.courses.push(course); writeDb(db); res.status(201).json({ message: 'Curso criado com sucesso.', course });
});

adminRouter.put('/courses/:id', (req: Request & { auth?: any }, res: Response): void => {
  const db = readDb(); const course = db.courses.find(c => c.id === req.params.id);
  if (!course) { res.status(404).json({ error: 'Curso não encontrado.' }); return; }
  const { title, description, thumbnailUrl, status } = req.body;
  if (title !== undefined) course.title = String(title).trim();
  if (description !== undefined) course.description = String(description);
  if (thumbnailUrl !== undefined) course.thumbnailUrl = String(thumbnailUrl);
  if (status !== undefined) course.status = status;
  course.updatedAt = new Date().toISOString(); writeDb(db); res.json({ message: 'Curso atualizado com sucesso.', course });
});

adminRouter.get('/courses', (req: Request, res: Response): void => {
  const db = readDb();
  const courses = db.courses.map(c => {
    const modules = db.modules
      .filter(m => m.courseId === c.id)
      .sort((a, b) => a.position - b.position)
      .map(m => {
        const topics = db.topics
          .filter(t => t.moduleId === m.id)
          .sort((a, b) => a.position - b.position)
          .map(t => {
            const lessons = db.lessons
              .filter(l => l.topicId === t.id)
              .sort((a, b) => a.position - b.position);
            return { ...t, lessons };
          });
        return { ...m, releaseRule: m.releaseType, topics };
      });
    return { ...c, modules };
  });

  res.json({ courses, course: courses[0] || null, modules: courses[0]?.modules || [] });
});

adminRouter.post('/reorder', (req: Request, res: Response): void => {
  const { contentType, items } = req.body as { contentType: 'MODULE' | 'TOPIC' | 'LESSON'; items: Array<{ id: string; position: number }> };
  const db = readDb();
  const collection = contentType === 'MODULE' ? db.modules : contentType === 'TOPIC' ? db.topics : db.lessons;
  if (!Array.isArray(items) || !collection) { res.status(400).json({ error: 'Dados de ordenação inválidos.' }); return; }
  for (const item of items) { const entity = collection.find(value => value.id === item.id); if (entity) entity.position = Number(item.position); }
  writeDb(db); res.json({ message: 'Ordem atualizada com sucesso.' });
});

// POST /api/admin/modules
adminRouter.post('/modules', (req: Request & { auth?: any }, res: Response): void => {
  const { courseId, title, description, releaseType = 'AFTER_DAYS', releaseDays = 7, releaseDate, position } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Título do módulo é obrigatório.' });
    return;
  }
  if (!['IMMEDIATE', 'AFTER_DAYS', 'FIXED_DATE', 'MANUAL'].includes(String(releaseType))) { res.status(400).json({ error: 'Regra de liberação inválida.' }); return; }
  if (releaseType === 'FIXED_DATE' && (!releaseDate || Number.isNaN(new Date(releaseDate).getTime()))) { res.status(400).json({ error: 'Informe uma data válida para a liberação.' }); return; }

  const db = readDb();
  const cId = courseId || db.courses[0]?.id;

  const existingInCourse = db.modules.filter(m => m.courseId === cId);
  const pos = position !== undefined ? Number(position) : existingInCourse.length + 1;

  const newModule: Module = {
    id: `mod_${crypto.randomUUID()}`,
    courseId: cId,
    title: String(title).trim(),
    description: description ? String(description).trim() : '',
    position: pos,
    releaseType,
    releaseDays: Number(releaseDays) || 0,
    releaseDate: releaseDate || null,
    status: 'PUBLISHED',
  };

  db.modules.push(newModule);
  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'CREATE_MODULE',
    entityType: 'MODULE',
    entityId: newModule.id,
    details: { title: newModule.title, releaseType, releaseDays },
  });

  res.status(201).json({ message: 'Módulo criado com sucesso.', module: newModule });
});

// PUT /api/admin/modules/:id
adminRouter.put('/modules/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { title, description, releaseType, releaseDays, releaseDate, position, status } = req.body;

  const db = readDb();
  const mod = db.modules.find(m => m.id === id);
  if (!mod) {
    res.status(404).json({ error: 'Módulo não encontrado.' });
    return;
  }
  if (releaseType !== undefined && !['IMMEDIATE', 'AFTER_DAYS', 'FIXED_DATE', 'MANUAL'].includes(String(releaseType))) { res.status(400).json({ error: 'Regra de liberação inválida.' }); return; }
  if (releaseDate !== undefined && releaseDate && Number.isNaN(new Date(releaseDate).getTime())) { res.status(400).json({ error: 'Data de liberação inválida.' }); return; }

  if (title) mod.title = String(title).trim();
  if (description !== undefined) mod.description = String(description).trim();
  if (releaseType) mod.releaseType = releaseType;
  if (releaseDays !== undefined) mod.releaseDays = Number(releaseDays);
  if (releaseDate !== undefined) mod.releaseDate = releaseDate;
  if (position !== undefined) mod.position = Number(position);
  if (status) mod.status = status;

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'UPDATE_MODULE',
    entityType: 'MODULE',
    entityId: id,
    details: { title: mod.title, releaseType: mod.releaseType, releaseDays: mod.releaseDays },
  });

  res.json({ message: 'Módulo atualizado com sucesso.', module: mod });
});

// DELETE /api/admin/modules/:id
adminRouter.delete('/modules/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const db = readDb();
  const mod = db.modules.find(m => m.id === id);
  if (!mod) {
    res.status(404).json({ error: 'Módulo não encontrado.' });
    return;
  }

  const removedLessonIds = db.lessons.filter(l => l.moduleId === id).map(l => l.id);
  removeLessonsAndRelatedData(db, removedLessonIds);
  db.modules = db.modules.filter(m => m.id !== id);
  db.topics = db.topics.filter(t => t.moduleId !== id);
  db.userContentOverrides = db.userContentOverrides.filter(override => !(override.contentType === 'MODULE' && override.contentId === id));

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'DELETE_MODULE',
    entityType: 'MODULE',
    entityId: id,
    details: { title: mod.title },
  });

  res.json({ message: 'Módulo e suas aulas foram removidos.' });
});

// POST /api/admin/topics
adminRouter.post('/topics', (req: Request & { auth?: any }, res: Response): void => {
  const { moduleId, title, description, position } = req.body;
  if (!moduleId || !title) {
    res.status(400).json({ error: 'Módulo e título são obrigatórios.' });
    return;
  }

  const db = readDb();
  const existing = db.topics.filter(t => t.moduleId === moduleId);

  const topic: Topic = {
    id: `top_${crypto.randomUUID()}`,
    moduleId,
    title: String(title).trim(),
    description: description ? String(description).trim() : '',
    position: position !== undefined ? Number(position) : existing.length + 1,
  };

  db.topics.push(topic);
  writeDb(db);

  res.status(201).json({ message: 'Tópico criado com sucesso.', topic });
});

adminRouter.put('/topics/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { title, description, position } = req.body;
  const db = readDb();
  const topic = db.topics.find(t => t.id === req.params.id);
  if (!topic) { res.status(404).json({ error: 'Tópico não encontrado.' }); return; }
  if (title !== undefined && !String(title).trim()) { res.status(400).json({ error: 'Título do tópico é obrigatório.' }); return; }
  if (title !== undefined) topic.title = String(title).trim();
  if (description !== undefined) topic.description = String(description).trim();
  if (position !== undefined) topic.position = Number(position);
  writeDb(db);
  res.json({ message: 'Tópico atualizado com sucesso.', topic });
});

adminRouter.delete('/topics/:id', (req: Request & { auth?: any }, res: Response): void => {
  const db = readDb();
  const topic = db.topics.find(t => t.id === req.params.id);
  if (!topic) { res.status(404).json({ error: 'Tópico não encontrado.' }); return; }
  const removedLessonIds = db.lessons.filter(l => l.topicId === topic.id).map(l => l.id);
  removeLessonsAndRelatedData(db, removedLessonIds);
  db.topics = db.topics.filter(t => t.id !== topic.id);
  writeDb(db);
  res.json({ message: 'Tópico e suas aulas foram removidos.' });
});

// POST /api/admin/lessons
adminRouter.post('/lessons', (req: Request & { auth?: any }, res: Response): void => {
  const { topicId, moduleId, title, description, durationSeconds, isFreePreview } = req.body;
  if (!topicId || !moduleId || !title) {
    res.status(400).json({ error: 'Tópico, Módulo e Título são obrigatórios.' });
    return;
  }
  if (durationSeconds !== undefined && (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) <= 0)) { res.status(400).json({ error: 'A duração deve ser um número maior que zero.' }); return; }

  const db = readDb();
  const parentModule = db.modules.find(m => m.id === moduleId);
  const parentTopic = db.topics.find(t => t.id === topicId && t.moduleId === moduleId);
  if (!parentModule || !parentTopic) {
    res.status(400).json({ error: 'Tópico e módulo não correspondem.' });
    return;
  }
  const mod = parentModule;
  const existing = db.lessons.filter(l => l.topicId === topicId);

  const lesson: Lesson = {
    id: `les_${crypto.randomUUID()}`,
    topicId,
    moduleId,
    courseId: mod?.courseId || db.courses[0]?.id || 'crs_1',
    title: String(title).trim(),
    description: description ? String(description).trim() : '',
    position: existing.length + 1,
    durationSeconds: Number(durationSeconds) || 600,
    videoFileName: null,
    videoProvider: 'LOCAL_SECURE',
    supplementaryMaterials: [],
    practicalVideos: [],
    imageExercises: [],
    releaseType: 'INHERIT',
    releaseDays: 0,
    releaseDate: null,
    isFreePreview: Boolean(isFreePreview),
    status: 'PUBLISHED',
  };

  db.lessons.push(lesson);
  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'CREATE_LESSON',
    entityType: 'LESSON',
    entityId: lesson.id,
    details: { title: lesson.title, moduleId },
  });

  res.status(201).json({ message: 'Aula criada com sucesso.', lesson });
});

// PUT /api/admin/lessons/:id
adminRouter.put('/lessons/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const { title, description, durationSeconds, isFreePreview, status, supplementaryMaterials, releaseType, releaseDays, releaseDate } = req.body;

  const db = readDb();
  const lesson = db.lessons.find(l => l.id === id);
  if (!lesson) {
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }
  if (durationSeconds !== undefined && (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) <= 0)) { res.status(400).json({ error: 'A duração deve ser um número maior que zero.' }); return; }
  if (releaseType !== undefined && !['INHERIT', 'IMMEDIATE', 'AFTER_DAYS', 'FIXED_DATE', 'MANUAL'].includes(String(releaseType))) { res.status(400).json({ error: 'Regra de liberação inválida.' }); return; }

  if (title) lesson.title = String(title).trim();
  if (description !== undefined) lesson.description = String(description).trim();
  if (durationSeconds !== undefined) lesson.durationSeconds = Number(durationSeconds);
  if (isFreePreview !== undefined) lesson.isFreePreview = Boolean(isFreePreview);
  if (status) lesson.status = status;
  if (supplementaryMaterials) lesson.supplementaryMaterials = supplementaryMaterials;
  if (releaseType) lesson.releaseType = releaseType;
  if (releaseDays !== undefined) lesson.releaseDays = Number(releaseDays);
  if (releaseDate !== undefined) lesson.releaseDate = releaseDate || null;

  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'UPDATE_LESSON',
    entityType: 'LESSON',
    entityId: id,
    details: { title: lesson.title },
  });

  res.json({ message: 'Aula atualizada com sucesso.', lesson });
});

adminRouter.delete('/lessons/:id/video', (req: Request & { auth?: any }, res: Response): void => {
  const db = readDb();
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) { res.status(404).json({ error: 'Aula não encontrada.' }); return; }
  if (lesson.videoFileName) {
    const oldPath = path.join(VIDEO_DIR, lesson.videoFileName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  lesson.videoFileName = null;
  lesson.videoSizeBytes = undefined;
  lesson.videoUploadedAt = null;
  writeDb(db);
  res.json({ message: 'Vídeo removido com sucesso.', lesson });
});

// DELETE /api/admin/lessons/:id
adminRouter.delete('/lessons/:id', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const db = readDb();
  const lesson = db.lessons.find(l => l.id === id);
  if (!lesson) {
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }

  removeLessonsAndRelatedData(db, [id]);
  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'DELETE_LESSON',
    entityType: 'LESSON',
    entityId: id,
    details: { title: lesson.title },
  });

  res.json({ message: 'Aula removida com sucesso.' });
});

// POST /api/admin/lessons/:id/upload-video
adminRouter.post('/lessons/:id/upload-video', upload.single('video'), async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'Nenhum arquivo de vídeo foi enviado.' });
    return;
  }

  if (!isMp4File(file.path)) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: 'O arquivo não possui uma assinatura MP4 válida.' });
    return;
  }

  const db = readDb();
  const lesson = db.lessons.find(l => l.id === id);
  if (!lesson) {
    // Delete uploaded file to avoid orphan files
    fs.unlinkSync(file.path);
    res.status(404).json({ error: 'Aula não encontrada.' });
    return;
  }

  const finalPath = path.join(VIDEO_DIR, file.filename);
  try {
    await optimizeMp4(file.path, finalPath);
  } catch (error) {
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível otimizar o vídeo enviado.' });
    return;
  }
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  const oldFileName = lesson.videoFileName;
  lesson.videoFileName = file.filename;
  lesson.videoSizeBytes = fs.statSync(finalPath).size;
  lesson.videoUploadedAt = new Date().toISOString();
  lesson.videoProvider = 'LOCAL_SECURE';
  // A replacement changes the primary lesson. Every student must finish the
  // new primary video before private complementary media is available again.
  for (const progress of db.lessonProgress.filter(item => item.lessonId === lesson.id)) progress.mainVideoEndedAt = null;
  try {
    writeDb(db);
  } catch (error) {
    lesson.videoFileName = oldFileName;
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    throw error;
  }
  if (oldFileName) {
    const oldPath = path.join(VIDEO_DIR, oldFileName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'UPLOAD_VIDEO',
    entityType: 'LESSON',
    entityId: id,
    details: { originalName: file.originalname, sizeBytes: lesson.videoSizeBytes, filename: file.filename, optimizedForStreaming: true },
  });

  res.json({
    message: 'Vídeo otimizado e protegido no servidor com sucesso.',
    lesson: {
      id: lesson.id,
      title: lesson.title,
      videoFileName: lesson.videoFileName,
      sizeBytes: lesson.videoSizeBytes,
      optimizedForStreaming: true,
    },
  });
});

adminRouter.post('/lessons/:id/practical-videos', upload.single('video'), async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const file = req.file; const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id);
  if (!file || !lesson) { if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path); res.status(file ? 404 : 400).json({ error: file ? 'Aula não encontrada.' : 'Envie um vídeo MP4.' }); return; }
  if (!String(req.body.title || '').trim() || !isMp4File(file.path)) { fs.unlinkSync(file.path); res.status(400).json({ error: 'Título e MP4 válido são obrigatórios.' }); return; }
  const filename = `practical_${crypto.randomUUID()}.mp4`; const finalPath = path.join(VIDEO_DIR, filename);
  try { await optimizeMp4(file.path, finalPath); } catch (error) { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath); res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao otimizar vídeo.' }); return; }
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  const video = { id: `pvid_${crypto.randomUUID()}`, title: String(req.body.title).trim(), description: String(req.body.description || '').trim(), position: lesson.practicalVideos.length + 1, videoFileName: filename, sizeBytes: fs.statSync(finalPath).size, durationSeconds: Number(req.body.durationSeconds) || 0, uploadedAt: new Date().toISOString() };
  lesson.practicalVideos.push(video); await writeDbAndWait(db);
  logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'UPLOAD_PRACTICAL_VIDEO', entityType: 'LESSON', entityId: lesson.id, details: { videoId: video.id, title: video.title } });
  res.status(201).json({ message: 'Vídeo prático enviado e otimizado.', video: { ...video, videoFileName: undefined } });
});

adminRouter.delete('/lessons/:id/practical-videos/:videoId', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id); const video = lesson?.practicalVideos.find(item => item.id === req.params.videoId);
  if (!lesson || !video) { res.status(404).json({ error: 'Vídeo prático não encontrado.' }); return; }
  lesson.practicalVideos = lesson.practicalVideos.filter(item => item.id !== video.id).map((item, index) => ({ ...item, position: index + 1 }));
  await writeDbAndWait(db); const filePath = path.join(VIDEO_DIR, path.basename(video.videoFileName)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ message: 'Vídeo prático removido.' });
});

adminRouter.put('/lessons/:id/practical-videos/:videoId', async (req: Request, res: Response): Promise<void> => {
  const db = readDb(); const video = db.lessons.find(item => item.id === req.params.id)?.practicalVideos.find(item => item.id === req.params.videoId);
  if (!video) { res.status(404).json({ error: 'Vídeo prático não encontrado.' }); return; }
  if (req.body.title !== undefined) video.title = String(req.body.title).trim(); if (req.body.description !== undefined) video.description = String(req.body.description).trim(); if (req.body.position !== undefined) video.position = Number(req.body.position);
  await writeDbAndWait(db); res.json({ message: 'Vídeo prático atualizado.', video: { ...video, videoFileName: undefined } });
});

adminRouter.post('/lessons/:id/practical-videos/:videoId/replace', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  const file = req.file; const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id); const video = lesson?.practicalVideos.find(item => item.id === req.params.videoId);
  if (!file || !lesson || !video) { if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path); res.status(404).json({ error: 'Vídeo prático não encontrado.' }); return; }
  if (!isMp4File(file.path)) { fs.unlinkSync(file.path); res.status(400).json({ error: 'MP4 inválido.' }); return; }
  const filename = `practical_${crypto.randomUUID()}.mp4`; const finalPath = path.join(VIDEO_DIR, filename);
  try { await optimizeMp4(file.path, finalPath); if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (error) { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao otimizar vídeo.' }); return; }
  const previous = video.videoFileName; video.videoFileName = filename; video.sizeBytes = fs.statSync(finalPath).size; video.uploadedAt = new Date().toISOString(); await writeDbAndWait(db);
  const oldPath = path.join(VIDEO_DIR, path.basename(previous)); if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); res.json({ message: 'Vídeo prático substituído.' });
});

adminRouter.put('/lessons/:id/image-exercises/:exerciseId', async (req: Request, res: Response): Promise<void> => {
  const db = readDb(); const exercise = db.lessons.find(item => item.id === req.params.id)?.imageExercises.find(item => item.id === req.params.exerciseId);
  if (!exercise) { res.status(404).json({ error: 'Exercício não encontrado.' }); return; }
  if (req.body.title !== undefined) exercise.title = String(req.body.title).trim(); if (req.body.description !== undefined) exercise.description = String(req.body.description).trim(); if (req.body.position !== undefined) exercise.position = Number(req.body.position);
  await writeDbAndWait(db); res.json({ message: 'Exercício atualizado.', exercise });
});

adminRouter.post('/lessons/:id/image-exercises/:exerciseId/replace-:kind', imageUpload.single('image'), async (req: Request, res: Response): Promise<void> => {
  const file = req.file; const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id); const exercise = lesson?.imageExercises.find(item => item.id === req.params.exerciseId); const kind = req.params.kind;
  if (!file || !lesson || !exercise || !['original', 'corrected'].includes(kind)) { if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path); res.status(404).json({ error: 'Imagem ou exercício não encontrado.' }); return; }
  try {
    const asset = savePrivateImage(file); const previous = kind === 'original' ? exercise.original : exercise.corrected;
    if (kind === 'original') exercise.original = asset; else exercise.corrected = asset;
    await writeDbAndWait(db);
    if (previous) { const oldPath = path.join(LESSON_MEDIA_DIR, path.basename(previous.storageFileName)); if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); }
    res.json({ message: 'Imagem substituída com segurança.' });
  } catch (error) { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); res.status(400).json({ error: error instanceof Error ? error.message : 'Imagem inválida.' }); }
});

adminRouter.put('/lessons/:id/media-order', async (req: Request, res: Response): Promise<void> => {
  const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id); if (!lesson) { res.status(404).json({ error: 'Aula não encontrada.' }); return; }
  const order = (items: { id: string; position: number }[] | undefined, target: Array<{ id: string; position: number }>) => { if (!items) return; if (items.length !== target.length || items.some(item => !target.some(current => current.id === item.id))) throw new Error('Ordem de mídias inválida.'); items.forEach(item => { const current = target.find(value => value.id === item.id)!; current.position = Number(item.position); }); };
  try { order(req.body.practicalVideos, lesson.practicalVideos); order(req.body.imageExercises, lesson.imageExercises); await writeDbAndWait(db); res.json({ message: 'Ordem das mídias atualizada.' }); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Ordem inválida.' }); }
});

adminRouter.post('/lessons/:id/image-exercises', imageUpload.fields([{ name: 'original', maxCount: 1 }, { name: 'corrected', maxCount: 1 }]), async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined; const originalFile = files?.original?.[0]; const correctedFile = files?.corrected?.[0]; const allFiles = [originalFile, correctedFile].filter(Boolean) as Express.Multer.File[];
  const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id);
  if (!lesson || !originalFile || !String(req.body.title || '').trim()) { allFiles.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path)); res.status(400).json({ error: 'Título e imagem sem correção são obrigatórios.' }); return; }
  const moved: ImageAsset[] = [];
  try {
    const original = savePrivateImage(originalFile); moved.push(original);
    const corrected = correctedFile ? savePrivateImage(correctedFile) : undefined; if (corrected) moved.push(corrected);
    const exercise = { id: `imgex_${crypto.randomUUID()}`, title: String(req.body.title).trim(), description: String(req.body.description || '').trim(), position: lesson.imageExercises.length + 1, original, corrected };
    lesson.imageExercises.push(exercise); await writeDbAndWait(db);
    res.status(201).json({ message: 'Exercício de imagens enviado.', exercise: { ...exercise, original: { ...original, storageFileName: undefined }, corrected: corrected ? { ...corrected, storageFileName: undefined } : undefined } });
  } catch (error) {
    allFiles.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path)); moved.forEach(asset => { const target = path.join(LESSON_MEDIA_DIR, asset.storageFileName); if (fs.existsSync(target)) fs.unlinkSync(target); });
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao salvar imagens.' });
  }
});

adminRouter.delete('/lessons/:id/image-exercises/:exerciseId', async (req: Request, res: Response): Promise<void> => {
  const db = readDb(); const lesson = db.lessons.find(item => item.id === req.params.id); const exercise = lesson?.imageExercises.find(item => item.id === req.params.exerciseId);
  if (!lesson || !exercise) { res.status(404).json({ error: 'Exercício não encontrado.' }); return; }
  lesson.imageExercises = lesson.imageExercises.filter(item => item.id !== exercise.id).map((item, index) => ({ ...item, position: index + 1 })); await writeDbAndWait(db);
  for (const asset of [exercise.original, exercise.corrected].filter(Boolean) as ImageAsset[]) { const filePath = path.join(LESSON_MEDIA_DIR, path.basename(asset.storageFileName)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  res.json({ message: 'Exercício removido.' });
});

adminRouter.post('/lessons/:id/materials', materialUpload.single('file'), (req: Request & { auth?: any }, res: Response): void => {
  const file = req.file; const db = readDb(); const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!file) { res.status(400).json({ error: 'Envie um PDF ou documento válido.' }); return; }
  if (!lesson) { fs.unlinkSync(file.path); res.status(404).json({ error: 'Aula não encontrada.' }); return; }
  const materialId = `mat_${crypto.randomUUID()}`;
  const material = { id: materialId, title: file.originalname, type: file.mimetype === 'application/pdf' ? 'PDF' as const : 'DOCUMENT' as const, url: `/api/student/material/${lesson.id}/${materialId}`, sizeBytes: file.size, storageFileName: file.filename };
  lesson.supplementaryMaterials.push(material); writeDb(db); res.status(201).json({ message: 'Material enviado com sucesso.', material });
});

// GET /api/admin/sessions
adminRouter.get('/sessions', (req: Request, res: Response): void => {
  const db = readDb();
  const sessionsWithUser = db.sessions.map(s => {
    const user = db.users.find(u => u.id === s.userId);
    return {
      id: s.id,
      userId: s.userId,
      userName: user?.name || 'Desconhecido',
      userEmail: user?.email || 'Desconhecido',
      userRole: user?.role || 'STUDENT',
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      deviceInfo: s.deviceInfo,
      isActive: s.isActive,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      revokedAt: s.revokedAt,
      revokedReason: s.revokedReason,
    };
  });

  res.json({ sessions: sessionsWithUser });
});

// POST /api/admin/sessions/:id/revoke
adminRouter.post('/sessions/:id/revoke', (req: Request & { auth?: any }, res: Response): void => {
  const { id } = req.params;
  const db = readDb();
  const session = db.sessions.find(s => s.id === id);

  if (!session) {
    res.status(404).json({ error: 'Sessão não encontrada.' });
    return;
  }

  session.isActive = false;
  session.revokedAt = new Date().toISOString();
  session.revokedReason = 'REVOGADA_DIRETO_NO_PAINEL';
  writeDb(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'REVOKE_SESSION',
    entityType: 'SESSION',
    entityId: id,
    details: { targetUserId: session.userId },
  });

  res.json({ message: 'Sessão revogada com sucesso.' });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', (req: Request, res: Response): void => {
  const { limit = '100' } = req.query;
  const db = readDb();
  const logs = db.auditLogs.slice(0, parseInt(limit as string, 10) || 100);
  res.json({ logs: logs.map(log => ({ ...log, actorUserId: log.actorId, metadata: log.details })) });
});

// GET /api/admin/settings
adminRouter.get('/settings', (req: Request, res: Response): void => {
  const db = readDb();
  const smtp = db.systemSettings.smtp || {
    host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', username: process.env.SMTP_USER || '', from: process.env.SMTP_FROM || 'Mentoria A Mecânica <no-reply@localhost>', passwordConfigured: Boolean(process.env.SMTP_PASSWORD),
  };
  const { encryptedPassword: _encryptedPassword, ...safeSmtp } = smtp;
  res.json({ settings: { ...db.systemSettings, smtp: { ...safeSmtp, passwordConfigured: Boolean(smtp.encryptedPassword || process.env.SMTP_PASSWORD) } } });
});

// PUT /api/admin/settings
adminRouter.put('/settings', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  const db = readDb();
  const { smtp, ...generalSettings } = req.body || {};
  if (generalSettings.telegramGroupUrl !== undefined) {
    const url = String(generalSettings.telegramGroupUrl || '').trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.telegram.me'].includes(parsed.hostname)) throw new Error();
      } catch {
        res.status(400).json({ error: 'Informe um link HTTPS válido de t.me ou telegram.me.' }); return;
      }
    }
    generalSettings.telegramGroupUrl = url;
  }
  if (generalSettings.telegramHelpMessage !== undefined) {
    generalSettings.telegramHelpMessage = String(generalSettings.telegramHelpMessage).trim();
    if (generalSettings.telegramHelpMessage.length > 300) { res.status(400).json({ error: 'A mensagem do Telegram deve ter no máximo 300 caracteres.' }); return; }
  }
  if (generalSettings.telegramButtonLabel !== undefined) {
    generalSettings.telegramButtonLabel = String(generalSettings.telegramButtonLabel).trim();
    if (generalSettings.telegramButtonLabel.length > 40) { res.status(400).json({ error: 'O texto do botão deve ter no máximo 40 caracteres.' }); return; }
  }
  // Administrators can keep platform communications updated. SMTP itself
  // remains exclusive to the super administrator, but its presence in a full
  // settings form must not block unrelated fields such as Telegram.
  const canUpdateSmtp = req.auth?.user?.role === 'SUPER_ADMIN';
  db.systemSettings = {
    ...db.systemSettings,
    ...generalSettings,
    id: 'settings-default',
  };
  if (smtp && canUpdateSmtp) {
    const previous = db.systemSettings.smtp || { host: '', port: 587, secure: false, username: '', from: '', passwordConfigured: false };
    const nextPassword = String(smtp.password || '');
    db.systemSettings.smtp = {
      host: String(smtp.host || '').trim(), port: Number(smtp.port) || 587, secure: Boolean(smtp.secure), username: String(smtp.username || '').trim(), from: String(smtp.from || '').trim(),
      encryptedPassword: nextPassword ? encryptSecret(nextPassword) : previous.encryptedPassword,
      passwordConfigured: Boolean(nextPassword || previous.encryptedPassword || process.env.SMTP_PASSWORD),
      lastTestAt: nextPassword || JSON.stringify(smtp) !== JSON.stringify(previous) ? undefined : previous.lastTestAt,
      lastTestStatus: nextPassword || JSON.stringify(smtp) !== JSON.stringify(previous) ? undefined : previous.lastTestStatus,
    };
  }
  await writeDbAndWait(db);

  logAudit({
    actorId: req.auth.user.id,
    actorName: req.auth.user.name,
    actorRole: req.auth.user.role,
    action: 'UPDATE_SETTINGS',
    entityType: 'SETTINGS',
    entityId: 'settings-default',
    details: { generalSettingsUpdated: Object.keys(generalSettings), smtpUpdated: Boolean(smtp && canUpdateSmtp) },
  });

  const { encryptedPassword: _encryptedPassword, ...safeSmtp } = db.systemSettings.smtp || {};
  res.json({ message: 'Configurações atualizadas com sucesso.', settings: { ...db.systemSettings, smtp: { ...safeSmtp, passwordConfigured: Boolean(db.systemSettings.smtp?.encryptedPassword || process.env.SMTP_PASSWORD) } } });
});

// POST /api/admin/settings/smtp/test
adminRouter.post('/settings/smtp/test', async (req: Request & { auth?: any }, res: Response): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const db = readDb();
  const recipient = db.systemSettings.supportEmail;
  if (!recipient) { res.status(400).json({ error: 'Configure o e-mail de suporte antes de testar o SMTP.' }); return; }
  try {
    await sendSmtpTestEmail(recipient);
    db.systemSettings.smtp = { ...db.systemSettings.smtp, lastTestAt: new Date().toISOString(), lastTestStatus: 'SUCCESS' };
    await writeDbAndWait(db);
    logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'SMTP_TEST_SUCCESS', entityType: 'SETTINGS', entityId: 'settings-default' });
    res.json({ message: `E-mail de teste enviado para ${recipient}.`, lastTestAt: db.systemSettings.smtp.lastTestAt });
  } catch (error) {
    db.systemSettings.smtp = { ...db.systemSettings.smtp, lastTestAt: new Date().toISOString(), lastTestStatus: 'FAILED' };
    await writeDbAndWait(db);
    logAudit({ actorId: req.auth.user.id, actorName: req.auth.user.name, actorRole: req.auth.user.role, action: 'SMTP_TEST_FAILED', entityType: 'SETTINGS', entityId: 'settings-default' });
    res.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível validar o SMTP.' });
  }
});
