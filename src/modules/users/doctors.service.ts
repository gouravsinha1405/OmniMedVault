import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { MEDICAL_SPECIALTIES } from '../search/specialties.data';
import { AuthService } from '../auth/auth.service';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { DoctorProfile } from './doctor-profile.types';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);
  // ponytail: in-memory; keyed by userId
  private readonly doctors = new Map<string, DoctorProfile>();
  // secondary index: nmcId → userId (uniqueness guard)
  private readonly nmcIndex = new Map<string, string>();

  constructor(private readonly authService: AuthService) {}

  register(userId: string, phone: string, dto: RegisterDoctorDto): DoctorProfile {
    if (this.doctors.has(userId)) {
      throw new ConflictException({
        errorResponse: { errorCode: 1004, description: 'Doctor profile already exists for this user' },
      });
    }

    if (this.nmcIndex.has(dto.nmcId)) {
      throw new ConflictException({
        errorResponse: { errorCode: 1004, description: 'NMC ID already registered' },
      });
    }

    const specialty = MEDICAL_SPECIALTIES.find((s) => s.code === dto.specialtyCode && s.isActive);
    if (!specialty) {
      throw new NotFoundException({
        errorResponse: { errorCode: 1003, description: 'specialtyCode not found or inactive' },
      });
    }

    const now = new Date().toISOString();
    const profile: DoctorProfile = {
      id: randomUUID(),
      userId,
      nmcId: dto.nmcId,
      nmcVerified: false, // BR-D01
      verificationStatus: 'PENDING',
      specialtyCode: specialty.code,
      specialtyId: specialty.code, // ponytail: using code as id in memory layer; use UUID FK in prod
      specialtyDisplayName: specialty.displayName,
      subSpecialty: dto.subSpecialty ?? null,
      institutionId: dto.institutionId ?? null,
      fullName: dto.fullName,
      createdAt: now,
      updatedAt: now,
    };

    this.doctors.set(userId, profile);
    this.nmcIndex.set(dto.nmcId, userId);

    // BR-A08: upgrade role so next token refresh returns DOCTOR
    this.authService.upgradeRoleForPhone(phone, 'DOCTOR');

    // BR-D03: fire NMC verification async
    this.scheduleNmcVerification(profile.id, userId, dto.nmcId);

    return profile;
  }

  getByUserId(userId: string): DoctorProfile {
    const profile = this.doctors.get(userId);
    if (!profile) {
      throw new NotFoundException({
        errorResponse: { errorCode: 1003, description: 'Doctor profile not found' },
      });
    }
    return profile;
  }

  isNmcVerified(userId: string): boolean {
    return this.doctors.get(userId)?.nmcVerified ?? false;
  }

  // ponytail: simulates SQS worker with setTimeout; wire to real SQS consumer in prod
  private scheduleNmcVerification(doctorId: string, userId: string, nmcId: string): void {
    setTimeout(() => {
      const profile = this.doctors.get(userId);
      if (!profile) return;

      // Demo: treat any nmcId starting with 'VALID' as verified
      const verified = nmcId.toUpperCase().startsWith('VALID');
      const updated: DoctorProfile = {
        ...profile,
        nmcVerified: verified,
        verificationStatus: verified ? 'VERIFIED' : 'FAILED',
        updatedAt: new Date().toISOString(),
      };
      this.doctors.set(userId, updated);

      this.logger.log(
        `[NMC] doctor=${doctorId} nmcId=${nmcId} → ${updated.verificationStatus}`,
      );
    }, 5000);
  }
}
