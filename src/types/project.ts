// types/project.ts
export interface Project {
  id?: string;
  name: string;
  material: string;
  customMaterial?: string;
  materialCost?: string;
  fileUrl?: string;
  fileName?: string;
  userId?: string;
  createdAt?: string;
}