import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentRecord } from './document.types';

type StoredBlob = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

@Injectable()
export class DocumentsService {
  private readonly documents = new Map<string, DocumentRecord>();

  private readonly blobs = new Map<string, StoredBlob>();

  uploadDocument(
    user: AuthenticatedUser,
    file: Express.Multer.File,
    payload: UploadDocumentDto,
  ): DocumentRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const storageKey = `patients/${encodeURIComponent(user.phone)}/documents/${id}/${file.originalname}`;
    const record: DocumentRecord = {
      id,
      patientPhone: user.phone,
      type: payload.type,
      source: 'PATIENT_UPLOAD',
      storageKey,
      ocrStatus: 'PENDING',
      ocrText: payload.ocrText ?? null,
      tags: payload.tags ?? [],
      documentDate: payload.documentDate ?? null,
      uploadedByRole: user.role,
      uploadedFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      createdAt,
    };

    this.documents.set(id, record);
    this.blobs.set(id, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
    });

    return record;
  }

  listDocuments(
    patientPhone: string,
    query: ListDocumentsQueryDto,
  ): DocumentRecord[] {
    return Array.from(this.documents.values())
      .filter((document) => document.patientPhone === patientPhone)
      .filter((document) => !query.type || document.type === query.type)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getDocument(patientPhone: string, documentId: string): DocumentRecord {
    const document = this.documents.get(documentId);

    if (!document || document.patientPhone !== patientPhone) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  getDownloadUrl(patientPhone: string, documentId: string) {
    const document = this.getDocument(patientPhone, documentId);

    return {
      documentId: document.id,
      fileName: document.uploadedFileName,
      mimeType: document.mimeType,
      downloadUrl: `https://demo.omnimedvault.local/download/${document.id}`,
      expiresInSeconds: 900,
      storageKey: document.storageKey,
    };
  }
}
