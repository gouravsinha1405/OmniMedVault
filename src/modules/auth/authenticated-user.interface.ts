import { AuthRole } from './auth.types';

export type AuthenticatedUser = {
  phone: string;
  role: AuthRole;
};
