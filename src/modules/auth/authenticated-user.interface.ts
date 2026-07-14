export interface AuthenticatedUser {
  phone: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}