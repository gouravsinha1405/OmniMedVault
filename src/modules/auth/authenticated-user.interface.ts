export interface AuthenticatedUser {
  sub: string; // userId (UUID) — BR-A09
  phone: string;
  role: 'PATIENT' | 'DOCTOR' | 'HOSPITAL_ADMIN' | 'PLATFORM_ADMIN';
}
