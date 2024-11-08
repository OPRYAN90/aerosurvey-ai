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
        // Load CSS first with updated paths
        await loadStyles([
          '/potree/libs/jquery-ui/jquery-ui.min.css',
          '/potree/libs/spectrum/spectrum.css',
          '/potree/build/potree/potree.css'
        ]);

        // Load scripts in correct order with updated paths
        await loadScripts([
          '/potree/libs/jquery/jquery-3.1.1.min.js',
          '/potree/libs/proj4/proj4.js',
          '/potree/libs/jquery-ui/jquery-ui.min.js',
          '/potree/libs/three.js/build/three.min.js',
          '/potree/libs/stats.js/stats.min.js',
          '/potree/libs/spectrum/spectrum.js',
          '/potree/libs/jstree/jstree.js',
          '/potree/build/potree/potree.js'
        ]);

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
        
        // Initialize viewer
        // @ts-ignore
        const viewer = new Potree.Viewer(containerRef.current);
        viewerRef.current = viewer;

        // Configure viewer
        viewer.setEDLEnabled(true);
        viewer.setFOV(60);
        viewer.setPointBudget(1_000_000);
        viewer.setBackground('rgb(32, 32, 32)');

        console.log('Loading point cloud:', project.fileUrl);
        
        // Load point cloud data
        // @ts-ignore
        Potree.loadPointCloud(project.fileUrl, project.name, (e: any) => {
          const pointcloud = e.pointcloud;
          viewer.scene.addPointCloud(pointcloud);

          // Configure point cloud appearance
          pointcloud.material.size = 1;
          // @ts-ignore
          pointcloud.material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
          // @ts-ignore
          pointcloud.material.shape = Potree.PointShape.SQUARE;

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

  const loadScripts = async (urls: string[]) => {
    for (const url of urls) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.body.appendChild(script);
      });

      // Add a small delay between script loads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
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