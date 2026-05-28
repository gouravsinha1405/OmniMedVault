import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { PatientRoleGuard } from '../auth/patient-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ConsentService } from './consent.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { ConsentRecord } from './consent.types';

@Controller('consent')
@UseGuards(DemoAuthGuard, PatientRoleGuard)
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  grantConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: GrantConsentDto,
  ): ConsentRecord {
    const consent = this.consentService.grantConsent(user.phone, payload);

    this.auditService.recordEvent({
      actor: user,
      action: 'CONSENT_GRANT',
      resourceType: 'CONSENT',
      resourceId: consent.id,
      patientPhone: user.phone,
      details: {
        doctorPhone: consent.doctorPhone,
      },
    });

    return consent;
  }

  @Get()
  listConsents(@CurrentUser() user: AuthenticatedUser): ConsentRecord[] {
    return this.consentService.listConsents(user.phone);
  }

  @Delete(':doctorId')
  revokeConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('doctorId') doctorId: string,
  ) {
    const result = this.consentService.revokeConsent(user.phone, doctorId);

    this.auditService.recordEvent({
      actor: user,
      action: 'CONSENT_REVOKE',
      resourceType: 'CONSENT',
      resourceId: doctorId,
      patientPhone: user.phone,
      details: {
        doctorPhone: doctorId,
      },
    });

    return result;
  }
}
