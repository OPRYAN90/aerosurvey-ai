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
  conversionStatus?: 'pending' | 'converting' | 'converted' | 'error';
  convertedUrl?: string;
  conversionProgress?: number;
  conversionError?: string;
  coverageArea?: {
    bounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
    center?: {
      longitude: number;
      latitude: number;
    };
  };
  groundSegmentationStatus?: 'pending' | 'processing' | 'completed' | 'error';
  groundSegmentationProgress?: number;
  groundSegmentationError?: string;
  groundSegmentation?: {
    metadata: {
      totalPoints: number;
      groundPoints: number;
      nonGroundPoints: number;
      success: boolean;
    };
    hasClassification: boolean;
  };
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