import { AuthRole } from '../auth/auth.types';

export type AuditAction =
  | 'VIEW'
  | 'DOWNLOAD'
  | 'UPDATE'
  | 'UPLOAD'
  | 'PRESCRIBE'
  | 'QUERY'
  | 'CONSENT_GRANT'
  | 'CONSENT_REVOKE';

export type AuditResourceType =
  | 'PROFILE'
  | 'DOCUMENT'
  | 'CONSENT'
  | 'PRESCRIPTION'
  | 'TIMELINE';

export type AuditLogRecord = {
  id: string;
  actorId: string;
  actorRole: AuthRole;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  patientPhone: string;
  timestamp: string;
  details?: Record<string, string>;
};
