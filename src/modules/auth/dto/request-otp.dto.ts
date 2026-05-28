import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { AUTH_ROLES } from '../auth.types';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/)
  phone!: string;

  @IsOptional()
  @IsIn(AUTH_ROLES)
  role?: (typeof AUTH_ROLES)[number];
}
