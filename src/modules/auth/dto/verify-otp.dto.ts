import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

import { AUTH_ROLES } from '../auth.types';

export class VerifyOtpDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/)
  phone!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsOptional()
  @IsIn(AUTH_ROLES)
  role?: (typeof AUTH_ROLES)[number];
}
