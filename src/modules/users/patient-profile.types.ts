export type SubscriptionTier = 'FREE' | 'PREMIUM';

export type PatientProfile = {
  id: string;
  phone: string;
  name: string | null;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-' | null;
  abhaId: string | null;
  allergies: string[];
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
