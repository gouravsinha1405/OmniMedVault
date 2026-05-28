import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfile } from './patient-profile.types';

@Injectable()
export class UsersService {
  private readonly patientProfiles = new Map<string, PatientProfile>();

  getPatientProfile(phone: string): PatientProfile {
    return this.ensurePatientProfile(phone);
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
