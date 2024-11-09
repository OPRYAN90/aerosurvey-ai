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

  // Step 1: Load all required dependencies
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        console.log('Starting to load dependencies...');
        
        // Load CSS first with updated paths
        await loadStyles([
          '/potree/libs/jquery-ui/jquery-ui.min.css',
          '/potree/libs/spectrum/spectrum.css',
          '/potree/build/potree/potree.css'
        ]);

        // Updated script list with LAZ workers
        const scripts = [
          // Core dependencies
          '/potree/libs/jquery/jquery-3.1.1.min.js',
          '/potree/libs/three.js/build/three.min.js',
          '/potree/libs/other/BinaryHeap.js',
          '/potree/libs/tween/tween.min.js',
          '/potree/libs/proj4/proj4.js',
          '/potree/libs/jquery-ui/jquery-ui.min.js',
          '/potree/libs/other/stats.min.js',
          '/potree/libs/spectrum/spectrum.js',
          
          // LAZ dependencies
          '/potree/libs/plasio/js/laslaz.js',
          '/potree/libs/plasio/vendor/bluebird.js',
          '/potree/libs/plasio/workers/laz-perf.js',
          '/potree/libs/plasio/workers/laz-loader-worker.js',
          
          // Main Potree library
          '/potree/build/potree/potree.js'
        ];

        for (const script of scripts) {
          console.log(`Loading script: ${script}`);
          await loadScript(script);
          await new Promise(resolve => setTimeout(resolve, 100));
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

  // Step 2: Initialize viewer after dependencies are loaded
  useEffect(() => {
    if (!isDependenciesLoaded || !containerRef.current || !project.fileUrl) return;

    const initViewer = async () => {
      try {
        // Ensure container has dimensions
        if (!containerRef.current?.clientWidth) {
          throw new Error('Container not ready');
        }

        console.log('Initializing Potree viewer...');
        
        if (!window.Potree) {
          throw new Error('Potree not initialized');
        }

        // Updated viewer initialization with better defaults
        const viewer = new window.Potree.Viewer(containerRef.current, {
          useDefaultRenderLoop: true,
          pointBudget: 1_000_000,
          fov: 60,
          edlEnabled: true,
          background: 'rgb(32, 32, 32)',
          description: '',
          useEDL: true
        });

        viewerRef.current = viewer;

        console.log('Loading point cloud:', project.fileUrl);
        
        // Load point cloud data
        window.Potree.loadPointCloud(project.fileUrl, project.name, (e: any) => {
          const pointcloud = e.pointcloud;
          viewer.scene.addPointCloud(pointcloud);

          // Configure point cloud appearance
          pointcloud.material.size = 1;
          pointcloud.material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
          pointcloud.material.shape = window.Potree.PointShape.SQUARE;
          pointcloud.material.pointColorType = window.Potree.PointColorType.RGB;
          pointcloud.material.pointShape = window.Potree.PointShape.SQUARE;

          viewer.fitToScreen();
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error initializing viewer:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to initialize viewer');
      }
    };

    // Wait for next frame to ensure container is ready
    requestAnimationFrame(() => {
      initViewer();
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
      }
    };
  }, [isDependenciesLoaded, project, onError]);

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