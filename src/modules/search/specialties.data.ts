export type MedicalSpecialty = {
  code: string;
  displayName: string;
  commonName: string;
  isActive: boolean;
};

export const MEDICAL_SPECIALTIES: MedicalSpecialty[] = [
  { code: 'GENERAL_MEDICINE', displayName: 'General Medicine / GP', commonName: 'GP, Family Doctor', isActive: true },
  { code: 'PEDIATRICS', displayName: 'Pediatrics', commonName: 'Child, Paeds', isActive: true },
  { code: 'ORTHOPEDICS', displayName: 'Orthopedics', commonName: 'Bone, Ortho', isActive: true },
  { code: 'CARDIOLOGY', displayName: 'Cardiology', commonName: 'Heart', isActive: true },
  { code: 'NEUROLOGY', displayName: 'Neurology', commonName: 'Brain, Neuro', isActive: true },
  { code: 'DERMATOLOGY', displayName: 'Dermatology', commonName: 'Skin', isActive: true },
  { code: 'OPHTHALMOLOGY', displayName: 'Ophthalmology', commonName: 'Eye', isActive: true },
  { code: 'DENTISTRY', displayName: 'Dentistry', commonName: 'Tooth, Dental', isActive: true },
  { code: 'ENT', displayName: 'ENT (Ear, Nose & Throat)', commonName: 'ENT', isActive: true },
  { code: 'GYNECOLOGY', displayName: 'Gynecology & Obstetrics', commonName: 'Gynae, OB', isActive: true },
  { code: 'PSYCHIATRY', displayName: 'Psychiatry & Mental Health', commonName: 'Mental Health', isActive: true },
  { code: 'PULMONOLOGY', displayName: 'Pulmonology', commonName: 'Lungs, Chest', isActive: true },
  { code: 'GASTROENTEROLOGY', displayName: 'Gastroenterology', commonName: 'Stomach, Digestive', isActive: true },
  { code: 'NEPHROLOGY', displayName: 'Nephrology', commonName: 'Kidney', isActive: true },
  { code: 'UROLOGY', displayName: 'Urology', commonName: 'Urology', isActive: true },
  { code: 'ONCOLOGY', displayName: 'Oncology', commonName: 'Cancer', isActive: true },
  { code: 'ENDOCRINOLOGY', displayName: 'Endocrinology', commonName: 'Diabetes, Thyroid, Hormones', isActive: true },
  { code: 'RHEUMATOLOGY', displayName: 'Rheumatology', commonName: 'Joints, Arthritis', isActive: true },
  { code: 'PHYSIOTHERAPY', displayName: 'Physiotherapy & Rehabilitation', commonName: 'Physio', isActive: true },
  { code: 'RADIOLOGY', displayName: 'Radiology & Imaging', commonName: 'X-Ray, Scan', isActive: true },
  { code: 'AYURVEDA', displayName: 'Ayurveda / Homeopathy / Naturopathy', commonName: 'Ayurveda', isActive: true },
  { code: 'EMERGENCY', displayName: 'Emergency Medicine', commonName: 'Emergency, Casualty', isActive: true },
];
