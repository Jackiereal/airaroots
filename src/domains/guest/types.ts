export type Guest = {
  id: string;
  organizationId: string;
  fullName: string;
  email: string | undefined;
  phone: string | undefined;
  nationality: string | undefined;
  notes: string | undefined;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateGuestInput = {
  organizationId: string;
  fullName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  notes?: string;
  tags?: string[];
};
