import { useEffect, useRef, useState } from 'react';
import { Project } from '@/types/project';

interface PotreeViewerProps {
  project: Project;
  onError?: (error: string) => void;
}

export default function PotreeViewer({ project, onError }: PotreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDependenciesLoaded, setIsDependenciesLoaded] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        console.log('Starting to load dependencies...');
        
        await loadStyles([
          '/potree/libs/jquery-ui/jquery-ui.min.css',
          '/potree/libs/spectrum/spectrum.css',
          '/potree/libs/jstree/themes/mixed/style.css',
          '/potree/build/potree/potree.css'
        ]);

        const scripts = [
          '/potree/libs/jquery/jquery-3.1.1.min.js',
          '/potree/libs/three.js/build/three.min.js',
          '/potree/libs/other/BinaryHeap.js',
          '/potree/libs/tween/tween.min.js',
          '/potree/libs/proj4/proj4.js',
          '/potree/libs/jquery-ui/jquery-ui.min.js',
          '/potree/libs/spectrum/spectrum.js',
          '/potree/libs/i18next/i18next.js',
          '/potree/libs/d3/d3.js',
          '/potree/libs/jstree/jstree.js',
          '/potree/build/potree/potree.js'
        ];

        for (const script of scripts) {
          console.log(`Loading script: ${script}`);
          await loadScript(script);
          if (script.includes('potree.js')) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        console.log('All dependencies loaded successfully');
        setIsDependenciesLoaded(true);
      } catch (error) {
        console.error('Error loading dependencies:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to load dependencies');
      }
    };

    loadDependencies();
  }, [onError]);

  useEffect(() => {
    if (!isDependenciesLoaded || !containerRef.current || !project.convertedUrl) {
      return;
    }

    const initViewer = async () => {
      try {
        const publicUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/converted/${project.id}/metadata.json`;
        console.log('Initializing viewer with URL:', publicUrl);
        
        if (!window.Potree) {
          throw new Error('Potree not initialized');
        }

        // Set a timeout for loading
        loadingTimeoutRef.current = setTimeout(() => {
          onError?.('Loading timeout - viewer took too long to initialize');
          setIsLoading(false);
        }, 30000); // 30 second timeout

        const viewer = new window.Potree.Viewer(containerRef.current, {
          useDefaultRenderLoop: true,
          pointBudget: 1_000_000,
          fov: 60,
          edlEnabled: true,
          background: 'rgb(32, 32, 32)',
          useEDL: true,
          showStats: false
        });

        // Initialize Potree's GUI
        viewer.loadGUI(() => {
          viewer.setLanguage('en');
          viewer.toggleSidebar();
        });

        viewerRef.current = viewer;

        window.Potree.loadPointCloud(publicUrl, project.name || 'point cloud', (e: any) => {
          // Clear timeout since point cloud loaded
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          if (!e || !e.pointcloud) {
            throw new Error('Invalid point cloud data received');
          }

          console.log('Point cloud loaded:', e);
          const pointcloud = e.pointcloud;
          
          try {
            viewer.scene.addPointCloud(pointcloud);

            const material = pointcloud.material;
            material.size = 1;
            material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
            material.shape = window.Potree.PointShape.SQUARE;
            
            // Simplified color type setting
            if (pointcloud.hasRGB) {
              material.pointColorType = 0; // RGB
              console.log('Using RGB coloring');
            } else if (pointcloud.intensity) {
              material.pointColorType = 1; // Intensity
              console.log('Using intensity coloring');
            } else {
              material.pointColorType = 2; // Height
              console.log('Using height coloring');
            }

            // Force a render update
            viewer.scene.dispatchEvent({ type: 'point_cloud_loaded' });
            
            // Small delay before fitToScreen to ensure proper initialization
            setTimeout(() => {
              viewer.fitToScreen();
              setIsLoading(false);
            }, 100);

          } catch (error) {
            console.error('Error configuring point cloud:', error);
            onError?.(error instanceof Error ? error.message : 'Failed to configure point cloud');
            setIsLoading(false);
          }
        });
      } catch (error) {
        console.error('Error initializing viewer:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      // Clear any pending timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      // Enhanced cleanup for viewer
      if (viewerRef.current) {
        try {
          if (viewerRef.current.renderer) {
            viewerRef.current.renderer.dispose();
          }
          if (viewerRef.current.scene) {
            viewerRef.current.scene.pointclouds = [];
          }
          viewerRef.current.destroy();
          viewerRef.current = null;
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
    };
  }, [isDependenciesLoaded, project.convertedUrl, project.id, project.name, onError]);

  const loadStyles = async (urls: string[]) => {
    const promises = urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`link[href="${url}"]`)) {
          resolve();
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load style: ${url}`));
        document.head.appendChild(link);
      });
    });

    await Promise.all(promises);
  };

  const loadScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.body.appendChild(script);
    });
  };

  return (
    <div className="relative w-full h-full min-h-[600px]">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-white">
              {!isDependenciesLoaded ? 'Loading dependencies...' : 'Loading point cloud...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 