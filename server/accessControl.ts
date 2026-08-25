import { readDb, User, Lesson, Module } from './db.js';

export interface AccessCheckResult {
  allowed: boolean;
  reason?: 'USER_INACTIVE' | 'USER_EXPIRED' | 'OVERRIDE_DENIED' | 'DAYS_RESTRICTION' | 'FIXED_DATE_RESTRICTION' | 'MANUAL_RESTRICTION' | 'NOT_FOUND' | 'OK';
  daysRemaining?: number;
  availableAt?: string;
  isOverrideAllowed?: boolean;
}

export function calculateDiffDays(startDateStr: string): number {
  const start = new Date(startDateStr);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function canUserAccessModule(userId: string, moduleId: string): AccessCheckResult {
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  const mod = db.modules.find(m => m.id === moduleId);

  if (!user || !mod) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }

  // Admins always have access
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { allowed: true, reason: 'OK' };
  }

  // 1. Account Status
  if (user.status !== 'ACTIVE') {
    return { allowed: false, reason: 'USER_INACTIVE' };
  }

  // 2. Account Expiration
  if (new Date(user.expirationDate) < new Date()) {
    return { allowed: false, reason: 'USER_EXPIRED' };
  }

  // 3. Check Individual Overrides
  // Check Course level override first
  const courseOverride = db.userContentOverrides.find(o => o.userId === userId && o.contentType === 'COURSE' && o.contentId === mod.courseId);
  if (courseOverride?.action === 'DENY') {
    return { allowed: false, reason: 'OVERRIDE_DENIED' };
  }

  // Check Module level override
  const modOverride = db.userContentOverrides.find(o => o.userId === userId && o.contentType === 'MODULE' && o.contentId === moduleId);
  if (modOverride?.action === 'DENY') {
    return { allowed: false, reason: 'OVERRIDE_DENIED' };
  }
  if (modOverride?.action === 'ALLOW' || courseOverride?.action === 'ALLOW') {
    return { allowed: true, reason: 'OK', isOverrideAllowed: true };
  }

  // 4. Evaluate Standard Module Release Rules
  if (mod.releaseType === 'IMMEDIATE') {
    return { allowed: true, reason: 'OK' };
  }

  if (mod.releaseType === 'AFTER_DAYS') {
    const requiredDays = mod.releaseDays || db.systemSettings.progressiveReleaseDays || 7;
    const diffDays = calculateDiffDays(user.startDate);
    
    if (diffDays >= requiredDays) {
      return { allowed: true, reason: 'OK' };
    }

    const startDate = new Date(user.startDate);
    const availableDate = new Date(startDate.getTime() + requiredDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(1, requiredDays - diffDays);

    return {
      allowed: false,
      reason: 'DAYS_RESTRICTION',
      daysRemaining,
      availableAt: availableDate.toISOString(),
    };
  }

  if (mod.releaseType === 'FIXED_DATE') {
    if (!mod.releaseDate) return { allowed: true, reason: 'OK' };
    const fixedDate = new Date(mod.releaseDate);
    if (new Date() >= fixedDate) {
      return { allowed: true, reason: 'OK' };
    }
    return {
      allowed: false,
      reason: 'FIXED_DATE_RESTRICTION',
      availableAt: fixedDate.toISOString(),
    };
  }

  if (mod.releaseType === 'MANUAL') {
    return { allowed: false, reason: 'MANUAL_RESTRICTION' };
  }

  return { allowed: true, reason: 'OK' };
}

export function canUserAccessLesson(userId: string, lessonId: string): AccessCheckResult {
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  const lesson = db.lessons.find(l => l.id === lessonId);

  if (!user || !lesson) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }

  // Admins always have access
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { allowed: true, reason: 'OK' };
  }

  // Free preview check
  if (lesson.isFreePreview && user.status === 'ACTIVE') {
    return { allowed: true, reason: 'OK' };
  }

  // 1. Account Status
  if (user.status !== 'ACTIVE') {
    return { allowed: false, reason: 'USER_INACTIVE' };
  }

  // 2. Account Expiration
  if (new Date(user.expirationDate) < new Date()) {
    return { allowed: false, reason: 'USER_EXPIRED' };
  }

  // 3. Check Individual Lesson Override
  const lessonOverride = db.userContentOverrides.find(o => o.userId === userId && o.contentType === 'LESSON' && o.contentId === lessonId);
  if (lessonOverride?.action === 'DENY') {
    return { allowed: false, reason: 'OVERRIDE_DENIED' };
  }
  if (lessonOverride?.action === 'ALLOW') {
    return { allowed: true, reason: 'OK', isOverrideAllowed: true };
  }

  // 4. Check Module Access
  const moduleCheck = canUserAccessModule(userId, lesson.moduleId);
  if (!moduleCheck.allowed) {
    return moduleCheck;
  }

  // 5. Check Lesson Specific Release Rule if not INHERIT
  if (lesson.releaseType === 'IMMEDIATE' || lesson.releaseType === 'INHERIT') {
    return { allowed: true, reason: 'OK' };
  }

  if (lesson.releaseType === 'AFTER_DAYS') {
    const requiredDays = lesson.releaseDays || 7;
    const diffDays = calculateDiffDays(user.startDate);
    if (diffDays >= requiredDays) {
      return { allowed: true, reason: 'OK' };
    }
    const startDate = new Date(user.startDate);
    const availableDate = new Date(startDate.getTime() + requiredDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(1, requiredDays - diffDays);
    return {
      allowed: false,
      reason: 'DAYS_RESTRICTION',
      daysRemaining,
      availableAt: availableDate.toISOString(),
    };
  }

  return { allowed: true, reason: 'OK' };
}
