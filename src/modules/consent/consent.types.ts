export type ConsentStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type ConsentRecord = {
  id: string;
  patientPhone: string;
  doctorPhone: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: ConsentStatus;
};
