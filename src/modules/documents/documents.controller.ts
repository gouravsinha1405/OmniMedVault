import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { PatientRoleGuard } from '../auth/patient-role.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentRecord } from './document.types';
import { DocumentsService } from './documents.service';

// S02: timeline and documents share DocumentsService; co-locating avoids cross-module injection
@Controller()
@UseGuards(DemoAuthGuard, PatientRoleGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly auditService: AuditService,
  ) {}

  // S02 — GET /api/v1/patients/me/timeline
  @Get('patients/me/timeline')
  getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDocumentsQueryDto,
  ) {
    this.auditService.recordEvent({
      actor: user,
      action: 'VIEW',
      resourceType: 'TIMELINE',
      resourceId: user.sub,
      patientPhone: user.phone,
    });
    return this.documentsService.listDocuments(user.phone, query);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() payload: UploadDocumentDto,
  ): DocumentRecord {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const document = this.documentsService.uploadDocument(user, file, payload);

    this.auditService.recordEvent({
      actor: user,
      action: 'UPLOAD',
      resourceType: 'DOCUMENT',
      resourceId: document.id,
      patientPhone: user.phone,
      details: { type: document.type },
    });

    return document;
  }

  @Get('documents')
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDocumentsQueryDto,
  ): DocumentRecord[] {
    return this.documentsService.listDocuments(user.phone, query);
  }

  @Get('documents/:id')
  getDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) documentId: string,
  ): DocumentRecord {
    const document = this.documentsService.getDocument(user.phone, documentId);

    this.auditService.recordEvent({
      actor: user,
      action: 'VIEW',
      resourceType: 'DOCUMENT',
      resourceId: document.id,
      patientPhone: user.phone,
      details: { mode: 'metadata' },
    });

    return document;
  }

  @Get('documents/:id/download')
  getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) documentId: string,
  ) {
    const download = this.documentsService.getDownloadUrl(user.phone, documentId);

    this.auditService.recordEvent({
      actor: user,
      action: 'DOWNLOAD',
      resourceType: 'DOCUMENT',
      resourceId: download.documentId,
      patientPhone: user.phone,
      details: { mode: 'download-url' },
    });

    return download;
  }
}
