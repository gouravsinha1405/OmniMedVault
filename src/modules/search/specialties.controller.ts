import { Controller, Get } from '@nestjs/common';

import { MedicalSpecialty } from './specialties.data';
import { SpecialtiesService } from './specialties.service';

@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  list(): MedicalSpecialty[] {
    return this.specialtiesService.list();
  }
}
