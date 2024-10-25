export interface Project {
  id?: string;
  name: string;
  material: string;
  customMaterial: string;
  materialCost: string;
  file?: File | null;
  fileUrl?: string;  // Make sure this is optional
  userId?: string;
  createdAt?: string;
  fileName?: string;
}
