import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsIn(['PATIENT', 'DOCTOR', 'ADMIN'])
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}