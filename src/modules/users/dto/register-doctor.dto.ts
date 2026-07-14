import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { MEDICAL_SPECIALTIES } from '../../search/specialties.data';

const SPECIALTY_CODES = MEDICAL_SPECIALTIES.map((s) => s.code);

export class RegisterDoctorDto {
  // BR-D03: 7–10 digit alphanumeric NMC registration number
  @IsString()
  @Matches(/^[A-Za-z0-9]{7,10}$/, { message: 'nmcId must be 7–10 alphanumeric characters' })
  nmcId!: string;

  @IsIn(SPECIALTY_CODES, { message: 'specialtyCode must be a valid active specialty' })
  specialtyCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subSpecialty?: string;

  @IsString()
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
