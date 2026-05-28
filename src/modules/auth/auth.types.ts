export const AUTH_ROLES = ['PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'PLATFORM_ADMIN'] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];
