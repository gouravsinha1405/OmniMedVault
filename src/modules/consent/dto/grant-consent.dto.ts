import { IsOptional, IsString, Matches } from 'class-validator';

export class GrantConsentDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/)
  doctorPhone!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  expiresAt?: string;
}
