import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfile } from './patient-profile.types';

@Injectable()
export class UsersService {
  // ponytail: in-memory; replace with TypeORM + encrypted columns for prod
  private readonly patientProfiles = new Map<string, PatientProfile>();

  hasPatientProfile(phone: string): boolean {
    return this.patientProfiles.has(phone);
  }

  getPatientProfile(phone: string): PatientProfile {
    return this.ensurePatientProfile(phone);
  }

  getPatientById(id: string): PatientProfile | undefined {
    for (const profile of this.patientProfiles.values()) {
      if (profile.id === id) return profile;
    }
    return undefined;
  }

  getPatientProfileSummary(phone: string): Pick<
    PatientProfile,
    'id' | 'phone' | 'name' | 'bloodGroup' | 'allergies' | 'isActive'
  > {
    const profile = this.ensurePatientProfile(phone);
    return {
      id: profile.id,
      phone: profile.phone,
      name: profile.name,
      bloodGroup: profile.bloodGroup,
      allergies: profile.allergies,
      isActive: profile.isActive,
    };
  }

  updatePatientProfile(phone: string, payload: UpdatePatientProfileDto): PatientProfile {
    const current = this.ensurePatientProfile(phone);

    // BR-S02: dateOfBirth must be in the past
    if (payload.dateOfBirth && new Date(payload.dateOfBirth) >= new Date()) {
      throw new BadRequestException({
        errorResponse: { errorCode: 1005, description: 'dateOfBirth must be a past date' },
      });
    }

    const next: PatientProfile = {
      ...current,
      name: payload.name ?? current.name,
      dateOfBirth: payload.dateOfBirth ?? current.dateOfBirth,
      gender: payload.gender ?? current.gender,
      bloodGroup: payload.bloodGroup ?? current.bloodGroup,
      abhaId: payload.abhaId ?? current.abhaId,
      allergies: payload.allergies ?? current.allergies,
      updatedAt: new Date().toISOString(),
    };

    this.patientProfiles.set(phone, next);
    return next;
  }

  private ensurePatientProfile(phone: string): PatientProfile {
    const existing = this.patientProfiles.get(phone);
    if (existing) return existing;

    const now = new Date().toISOString();
    const profile: PatientProfile = {
      id: randomUUID(),
      phone,
      name: null,
      dateOfBirth: null,
      gender: null,
      bloodGroup: null,
      abhaId: null,
      allergies: [],
      subscriptionTier: 'FREE', // BR-P04
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.patientProfiles.set(phone, profile);
    return profile;
  }
}
