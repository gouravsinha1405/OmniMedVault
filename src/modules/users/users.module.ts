import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PatientsController } from './patients.controller';
import { UsersService } from './users.service';

@Module({
	imports: [AuthModule, AuditModule],
	controllers: [PatientsController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}



