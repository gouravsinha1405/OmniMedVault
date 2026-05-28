import { Injectable } from '@nestjs/common';

import {
  MEDICAL_SPECIALTIES,
  MedicalSpecialty,
} from './specialties.data';

@Injectable()
export class SpecialtiesService {
  list(): MedicalSpecialty[] {
    return MEDICAL_SPECIALTIES;
  }
}
