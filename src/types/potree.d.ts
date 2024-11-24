declare module '@pnext/three-loader' {
  import * as THREE from 'three';

  export class Viewer {
    constructor(container: HTMLElement, options?: ViewerOptions);
    scene: {
      view: {
        position: THREE.Vector3;
        lookAt: (target: THREE.Vector3) => void;
      };
      addMeasurement: () => any;
      pointclouds: any[];
      dispatchEvent: (event: any) => void;
    };
    dispose: () => void;
    setDimensions: (width: number, height: number) => void;
    setEDLEnabled: (enabled: boolean) => void;
    setEDLRadius: (radius: number) => void;
    setEDLStrength: (strength: number) => void;
    loadPointCloud: (url: string, name: string, callback: (e: any) => void) => void;
    loadGUI: (callback: () => void) => void;
    setLanguage: (lang: string) => void;
  }

  export interface ViewerOptions {
    pointBudget?: number;
    fov?: number;
    edlEnabled?: boolean;
    background?: string;
    description?: string;
    useDefaultRenderLoop?: boolean;
  }

  export enum PointSizeType {
    FIXED,
    ATTENUATED,
    ADAPTIVE
  }

  export enum PointShape {
    SQUARE,
    CIRCLE,
    PARABOLOID
  }

  export interface PointCloudMaterial {
    size: number;
    pointSizeType: PointSizeType;
    shape: PointShape;
    classification: Record<number, { color: number[], name: string }>;
    pointColorType: number;
    activeAttributeName: string;
    classifications: Record<number, any>;
  }
}

declare global {
  interface Window {
    Potree: {
      Viewer: any;
      PointCloudMaterial: any;
      Classification: any;
      PointColorType: {
        CLASSIFICATION: number;
      };
    };
    THREE: any;
  }
} 