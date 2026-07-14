import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuditLogRecord } from '../audit/audit.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { PatientRoleGuard } from '../auth/patient-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfile } from './patient-profile.types';
import { UsersService } from './users.service';

type PatientProfileResponse = Omit<PatientProfile, 'phone' | 'isActive'>;

function toResponse(p: PatientProfile): PatientProfileResponse {
  // phone is the auth identity anchor — never returned in profile responses (S02)
  const { phone: _phone, isActive: _isActive, ...rest } = p;
  return rest;
}

@Controller('patients')
@UseGuards(DemoAuthGuard, PatientRoleGuard)
export class PatientsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): PatientProfileResponse {
    const profile = this.usersService.getPatientProfile(user.phone);

    this.auditService.recordEvent({
      actor: user,
      action: 'VIEW',
      resourceType: 'PROFILE',
      resourceId: profile.id,
      patientPhone: user.phone,
    });

    return toResponse(profile);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdatePatientProfileDto,
  ): PatientProfileResponse {
    const profile = this.usersService.updatePatientProfile(user.phone, payload);

    this.auditService.recordEvent({
      actor: user,
      action: 'UPDATE',
      resourceType: 'PROFILE',
      resourceId: profile.id,
      patientPhone: user.phone,
    });

    return toResponse(profile);
  }

  @Get('me/audit-log')
  getAuditLog(@CurrentUser() user: AuthenticatedUser): AuditLogRecord[] {
    return this.auditService.listPatientAuditLogs(user.phone);
  }
}
