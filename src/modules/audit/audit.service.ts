import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { AuditAction, AuditLogRecord, AuditResourceType } from './audit.types';

type RecordAuditEventInput = {
  actor: AuthenticatedUser;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  patientPhone: string;
  details?: Record<string, string>;
};

@Injectable()
export class AuditService {
  private readonly auditLogs: AuditLogRecord[] = [];

  recordEvent(input: RecordAuditEventInput): AuditLogRecord {
    const auditLog: AuditLogRecord = {
      id: randomUUID(),
      actorId: input.actor.phone,
      actorRole: input.actor.role,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      patientPhone: input.patientPhone,
      timestamp: new Date().toISOString(),
      details: input.details,
    };

    this.auditLogs.push(auditLog);
    return auditLog;
  }

  listPatientAuditLogs(patientPhone: string): AuditLogRecord[] {
    return this.auditLogs
      .filter((log) => log.patientPhone === patientPhone)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }
}
