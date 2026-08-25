import crypto from 'crypto';
import { readDb, writeDb, AuditLog } from './db.js';

export function logAudit(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): void {
  try {
    const db = readDb();
    const log: AuditLog = {
      id: `log_${crypto.randomUUID()}`,
      actorId: params.actorId || 'system',
      actorName: params.actorName || 'Sistema',
      actorRole: params.actorRole || 'SYSTEM',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details || {},
      ipAddress: params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || 'Internal',
      createdAt: new Date().toISOString(),
    };

    db.auditLogs.unshift(log);
    // Keep max 5000 logs in memory/disk
    if (db.auditLogs.length > 5000) {
      db.auditLogs = db.auditLogs.slice(0, 5000);
    }
    writeDb(db);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
