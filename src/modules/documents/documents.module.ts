import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
