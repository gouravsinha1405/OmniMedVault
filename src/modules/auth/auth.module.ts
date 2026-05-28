import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { DemoAuthGuard } from './demo-auth.guard';
import { PatientRoleGuard } from './patient-role.guard';
import { AuthService } from './auth.service';

@Module({
	controllers: [AuthController],
	providers: [AuthService, DemoAuthGuard, PatientRoleGuard],
	exports: [AuthService, DemoAuthGuard, PatientRoleGuard],
})
export class AuthModule {}

