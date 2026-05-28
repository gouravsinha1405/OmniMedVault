export type PatientProfile = {
  id: string;
  phone: string;
  name: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  abhaId: string | null;
  allergies: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
