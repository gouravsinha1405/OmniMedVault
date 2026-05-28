import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NlQueryModule } from './modules/nl-query/nl-query.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    OcrModule,
    SearchModule,
    PrescriptionsModule,
    ConsentModule,
    NotificationsModule,
    InstitutionsModule,
    NlQueryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
