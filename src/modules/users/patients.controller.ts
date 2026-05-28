import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { PatientRoleGuard } from '../auth/patient-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfile } from './patient-profile.types';
import { UsersService } from './users.service';

@Controller('patients')
@UseGuards(DemoAuthGuard, PatientRoleGuard)
export class PatientsController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): PatientProfile {
    return this.usersService.getPatientProfile(user.phone);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdatePatientProfileDto,
  ): PatientProfile {
    return this.usersService.updatePatientProfile(user.phone, payload);
  }
}
