import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PatientsController } from './patients.controller';
import { UsersService } from './users.service';

@Module({
	imports: [AuthModule],
	controllers: [PatientsController],
	providers: [UsersService],
})
export class UsersModule {}

