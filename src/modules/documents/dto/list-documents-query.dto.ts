import { IsIn, IsOptional } from 'class-validator';

import { DOCUMENT_TYPES } from '../document.types';

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: (typeof DOCUMENT_TYPES)[number];
}
