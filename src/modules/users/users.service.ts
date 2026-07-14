import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfile } from './patient-profile.types';

@Injectable()
export class UsersService {
  private readonly patientProfiles = new Map<string, PatientProfile>();

  hasPatientProfile(phone: string): boolean {
    return this.patientProfiles.has(phone);
  }

  getPatientProfile(phone: string): PatientProfile {
    return this.ensurePatientProfile(phone);
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

  updatePatientProfile(
    phone: string,
    payload: UpdatePatientProfileDto,
  ): PatientProfile {
    const currentProfile = this.ensurePatientProfile(phone);
    const nextProfile: PatientProfile = {
      ...currentProfile,
      name: payload.name ?? currentProfile.name,
      dateOfBirth: payload.dateOfBirth ?? currentProfile.dateOfBirth,
      gender: payload.gender ?? currentProfile.gender,
      bloodGroup: payload.bloodGroup ?? currentProfile.bloodGroup,
      abhaId: payload.abhaId ?? currentProfile.abhaId,
      allergies: payload.allergies ?? currentProfile.allergies,
      updatedAt: new Date().toISOString(),
    };

    this.patientProfiles.set(phone, nextProfile);
    return nextProfile;
  }

  private ensurePatientProfile(phone: string): PatientProfile {
    const existingProfile = this.patientProfiles.get(phone);

    if (existingProfile) {
      return existingProfile;
    }

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
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.patientProfiles.set(phone, profile);
    return profile;
  }
}
