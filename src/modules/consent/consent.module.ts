import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { DoctorsController } from './doctors.controller';

@Module({
	imports: [AuthModule, UsersModule, AuditModule],
	controllers: [ConsentController, DoctorsController],
	providers: [ConsentService],
	exports: [ConsentService],
})
export class ConsentModule {}


