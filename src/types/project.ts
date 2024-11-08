// types/project.ts
export interface Project {
  id?: string;
  name: string;
  material: string;
  customMaterial: string;
  materialCost: string;
  fileUrl?: string;
  fileName?: string;
  userId?: string;
  createdAt?: string;
  convertedUrl?: string; // URL to the converted Potree format
  processingStatus?: 'pending' | 'converting' | 'ready' | 'error';
}

export interface PointCloudData {
  url: string;
  name: string;
  settings?: {
    pointBudget?: number;
    pointSize?: number;
    material?: any;
  };
}