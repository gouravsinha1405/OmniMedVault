import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { DoctorRoleGuard } from '../auth/doctor-role.guard';
import { PatientRoleGuard } from '../auth/patient-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { DoctorsService } from './doctors.service';

@Controller('doctors')
@UseGuards(DemoAuthGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // S03: only a PATIENT-role user can register as doctor (BR-A08)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PatientRoleGuard)
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDoctorDto) {
    const profile = this.doctorsService.register(user.sub, user.phone, dto);
    return {
      id: profile.id,
      nmcId: profile.nmcId,
      nmcVerified: profile.nmcVerified,
      specialty: {
        id: profile.specialtyId,
        code: profile.specialtyCode,
        displayName: profile.specialtyDisplayName,
      },
      subSpecialty: profile.subSpecialty,
      institutionId: profile.institutionId,
      verificationStatus: profile.verificationStatus,
      createdAt: profile.createdAt,
    };
  }

  @Get('me')
  @UseGuards(DoctorRoleGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    const profile = this.doctorsService.getByUserId(user.sub);
    return {
      id: profile.id,
      nmcId: profile.nmcId,
      nmcVerified: profile.nmcVerified,
      verificationStatus: profile.verificationStatus,
      specialty: {
        id: profile.specialtyId,
        code: profile.specialtyCode,
        displayName: profile.specialtyDisplayName,
      },
      subSpecialty: profile.subSpecialty,
      institutionId: profile.institutionId,
      fullName: profile.fullName,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

}
// ponytail: GET /doctors/:id/patients lives in consent/doctors.controller.ts — already wired
