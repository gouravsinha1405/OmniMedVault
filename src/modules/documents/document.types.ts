export const DOCUMENT_TYPES = [
  'PRESCRIPTION',
  'LAB_REPORT',
  'RECEIPT',
  'OTHER',
] as const;

export const DOCUMENT_SOURCES = [
  'PATIENT_UPLOAD',
  'DOCTOR_CREATED',
  'LAB_UPLOAD',
] as const;

export const OCR_STATUSES = [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REVIEW_NEEDED',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];
export type OcrStatus = (typeof OCR_STATUSES)[number];

export type DocumentRecord = {
  id: string;
  patientPhone: string;
  type: DocumentType;
  source: DocumentSource;
  storageKey: string;
  ocrStatus: OcrStatus;
  ocrText: string | null;
  tags: string[];
  documentDate: string | null;
  uploadedByRole: string;
  uploadedFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
