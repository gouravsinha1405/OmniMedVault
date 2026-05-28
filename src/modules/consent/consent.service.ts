import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { ConsentRecord } from './consent.types';

@Injectable()
export class ConsentService {
  private readonly consents = new Map<string, ConsentRecord>();

  constructor(private readonly usersService: UsersService) {}

  grantConsent(patientPhone: string, payload: GrantConsentDto): ConsentRecord {
    if (payload.expiresAt && Number.isNaN(Date.parse(payload.expiresAt))) {
      throw new BadRequestException('Invalid expiresAt timestamp');
    }

    const activeExisting = this.listActiveConsentRecords(patientPhone).find(
      (consent) => consent.doctorPhone === payload.doctorPhone,
    );

    if (activeExisting) {
      return activeExisting;
    }

    const now = new Date().toISOString();
    const consent: ConsentRecord = {
      id: randomUUID(),
      patientPhone,
      doctorPhone: payload.doctorPhone,
      grantedAt: now,
      expiresAt: payload.expiresAt ?? null,
      revokedAt: null,
      status: 'ACTIVE',
    };

    this.consents.set(consent.id, consent);
    return consent;
  }

  listConsents(patientPhone: string): ConsentRecord[] {
    return this.listActiveConsentRecords(patientPhone);
  }

  revokeConsent(patientPhone: string, doctorPhone: string): { success: true } {
    const activeConsent = this.listActiveConsentRecords(patientPhone).find(
      (consent) => consent.doctorPhone === doctorPhone,
    );

    if (!activeConsent) {
      throw new BadRequestException('Active consent not found');
    }

    this.consents.set(activeConsent.id, {
      ...activeConsent,
      revokedAt: new Date().toISOString(),
      status: 'REVOKED',
    });

    return { success: true };
  }

  listConsentedPatientsForDoctor(doctorPhone: string, routeDoctorId: string) {
    if (doctorPhone !== routeDoctorId) {
      throw new ForbiddenException('Doctor can only view their own patient list');
    }

    return Array.from(this.consents.values())
      .map((consent) => this.resolveConsentStatus(consent))
      .filter(
        (consent) =>
          consent.status === 'ACTIVE' && consent.doctorPhone === doctorPhone,
      )
      .map((consent) => ({
        consentId: consent.id,
        grantedAt: consent.grantedAt,
        expiresAt: consent.expiresAt,
        patient: this.usersService.getPatientProfileSummary(consent.patientPhone),
      }));
  }

  private listActiveConsentRecords(patientPhone: string): ConsentRecord[] {
    return Array.from(this.consents.values())
      .map((consent) => this.resolveConsentStatus(consent))
      .filter(
        (consent) =>
          consent.patientPhone === patientPhone && consent.status === 'ACTIVE',
      );
  }

  private resolveConsentStatus(consent: ConsentRecord): ConsentRecord {
    if (consent.status === 'REVOKED') {
      return consent;
    }

    if (consent.expiresAt && Date.parse(consent.expiresAt) < Date.now()) {
      return {
        ...consent,
        status: 'EXPIRED',
      };
    }

    return consent;
  }
}
