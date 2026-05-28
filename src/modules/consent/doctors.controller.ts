import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { DoctorRoleGuard } from '../auth/doctor-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ConsentService } from './consent.service';

@Controller('doctors')
@UseGuards(DemoAuthGuard, DoctorRoleGuard)
export class DoctorsController {
  constructor(private readonly consentService: ConsentService) {}

  @Get(':id/patients')
  listConsentedPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') doctorId: string,
  ) {
    return this.consentService.listConsentedPatientsForDoctor(
      user.phone,
      doctorId,
    );
  }
}
