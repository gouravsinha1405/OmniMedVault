import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { PatientsController } from './patients.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PatientsController, DoctorsController],
  providers: [UsersService, DoctorsService],
  exports: [UsersService, DoctorsService],
})
export class UsersModule {}
