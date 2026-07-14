export type DoctorVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED';

export type DoctorProfile = {
  id: string;
  userId: string;
  nmcId: string;
  nmcVerified: boolean;
  verificationStatus: DoctorVerificationStatus;
  specialtyCode: string;
  specialtyId: string;
  specialtyDisplayName: string;
  subSpecialty: string | null;
  institutionId: string | null;
  fullName: string;
  createdAt: string;
  updatedAt: string;
};
