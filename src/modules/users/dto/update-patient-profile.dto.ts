import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

export class UpdatePatientProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: (typeof BLOOD_GROUPS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  allergies?: string[];

  // BR-P06: optional 14-digit ABHA format
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'abhaId must be 14 digits' })
  abhaId?: string;
}
