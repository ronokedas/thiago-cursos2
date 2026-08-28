export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STUDENT';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'BLOCKED';
  startDate: string;
  expirationDate: string;
  firstAccessAt?: string | null;
  lastAccessAt?: string | null;
  forcePasswordChange: boolean;
  notes?: string;
  unlockAllImmediately?: boolean;
  progressPercent?: number;
}

export interface AuditLogItem {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AdminStats {
  totalStudents: number;
  activeStudents: number;
  expiredStudents: number;
  suspendedStudents: number;
  activeSessions: number;
  totalModules: number;
  totalLessons: number;
  totalVideos: number;
}

export interface ActiveSessionAdmin {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  ipAddress: string;
  device: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface SystemSettings {
  platformName: string;
  brandTagline: string;
  supportEmail: string;
  timezone: string;
  defaultAccessMonths: number;
  progressiveReleaseDays: number;
  completionThresholdPercent: number;
  maxActiveSessionsPerUser: number;
  watermarkEnabled: boolean;
  watermarkIntervalSeconds: number;
  watermarkOpacity: number;
  noticeBanner?: string | null;
  telegramGroupUrl?: string;
  telegramHelpMessage?: string;
  telegramButtonLabel?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    from: string;
    passwordConfigured: boolean;
    lastTestAt?: string;
    lastTestStatus?: 'SUCCESS' | 'FAILED';
  };
  smtpPassword?: string;
}

export interface UserContentOverride {
  id: string;
  userId: string;
  contentType: 'MODULE' | 'LESSON';
  contentId: string;
  action: 'ALLOW' | 'DENY';
  createdAt: string;
  createdBy: string;
}

export interface StudentDetailAdmin {
  user: User;
  overrides: UserContentOverride[];
  progress: Array<{
    lessonId: string;
    progressPercent: number;
    completed: boolean;
    lastWatchedAt: string;
  }>;
  activeSession: ActiveSessionAdmin | null;
}

export interface SessionInfo {
  id: string;
  deviceInfo: string;
  createdAt?: string;
  lastActivityAt: string;
  ipAddress?: string;
  device?: string;
}

export interface WatermarkData {
  enabled: boolean;
  userName: string;
  userEmail: string;
  userMaskedEmail: string;
  accountId: string;
  clientIp: string;
  cpf?: string;
  timestamp: string;
  intervalSeconds: number;
}

export interface SupplementaryMaterial {
  id: string;
  title: string;
  type: 'PDF' | 'LINK' | 'DOCUMENT';
  url: string;
  sizeBytes?: number;
  storageFileName?: string;
}

export interface LessonAccess {
  allowed: boolean;
  reason?: 'USER_INACTIVE' | 'USER_EXPIRED' | 'OVERRIDE_DENIED' | 'DAYS_RESTRICTION' | 'FIXED_DATE_RESTRICTION' | 'MANUAL_RESTRICTION' | 'NOT_FOUND' | 'OK';
  daysRemaining?: number;
  availableAt?: string;
  isOverrideAllowed?: boolean;
}

export interface LessonSummary {
  id: string;
  title: string;
  description: string;
  position: number;
  durationSeconds: number;
  hasVideo: boolean;
  isFreePreview: boolean;
  access: LessonAccess;
  isCompleted: boolean;
  progressPercent: number;
  lastPositionSeconds: number;
  videoFileName?: string | null;
  videoSizeBytes?: number;
  videoUploadedAt?: string;
  supplementaryMaterials?: SupplementaryMaterial[];
  practicalVideos?: Array<{ id: string; title: string; description: string; position: number; sizeBytes: number; durationSeconds: number; uploadedAt: string }>;
  imageExercises?: Array<{ id: string; title: string; description: string; position: number; original?: { originalName: string }; corrected?: { originalName: string } }>;
}

export interface TopicSummary {
  id: string;
  title: string;
  description: string;
  position: number;
  lessons: LessonSummary[];
}

export interface ModuleSummary {
  id: string;
  title: string;
  description: string;
  position: number;
  releaseType: 'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL';
  releaseRule?: 'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL';
  releaseDays: number;
  releaseDate?: string | null;
  access: LessonAccess;
  topics: TopicSummary[];
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export interface StudentDashboardData {
  student: {
    id: string;
    name: string;
    email: string;
    startDate: string;
    expirationDate: string;
    daysUntilExpiration: number;
    isExpired: boolean;
    daysSinceStart: number;
  };
  metrics: {
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
  };
  lastWatchedLesson: {
    id: string;
    title: string;
    moduleTitle: string;
    lastPositionSeconds: number;
    progressPercent: number;
  } | null;
  settings: {
    platformName: string;
    brandTagline: string;
    supportEmail: string;
    noticeBanner: string | null;
    telegramGroupUrl?: string;
    telegramHelpMessage?: string;
    telegramButtonLabel?: string;
  };
}

export interface LessonDetail {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  hasVideo?: boolean;
  supplementaryMaterials: SupplementaryMaterial[];
  module: { id: string; title: string };
  topic: { id: string; title: string };
  prevLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
  practicalVideos?: Array<{ id: string; title: string; description: string; position: number; sizeBytes: number; durationSeconds: number; uploadedAt: string }>;
  imageExercises?: Array<{ id: string; title: string; description: string; position: number; originalDownloadUrl: string; hasCorrected: boolean; correctedViewUrl: string | null }>;
}

export interface PersonalNotebookImage {
  id: string;
  originalName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  uploadedAt: string;
  viewUrl: string;
}

export interface PersonalNotebook {
  createdAt: string | null;
  updatedAt: string | null;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
  }>;
  images: PersonalNotebookImage[];
}
