import { IsArray, IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { DOCUMENT_TYPES } from '../document.types';

export class UploadDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type!: (typeof DOCUMENT_TYPES)[number];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  documentDate?: string;

  @IsOptional()
  @IsString()
  ocrText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
