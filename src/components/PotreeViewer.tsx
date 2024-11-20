import { useEffect, useRef, useState } from 'react';
import { Project } from '@/types/project';

// Add type declaration for OpenLayers on window
declare global {
  interface Window {
    ol: any; // We could define proper types but using any for brevity
    Potree: any;
  }
}

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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const debugDOM = () => {
      console.log('Current DOM structure:', {
        container: containerRef.current,
        renderArea: document.getElementById('potree_render_area'),
        sidebar: document.getElementById('potree_sidebar_container'),
        map: document.getElementById('potree_map')
      });

      if (viewerRef.current) {
        console.log('Viewer state:', {
          viewer: viewerRef.current,
          scene: viewerRef.current.scene,
          gui: viewerRef.current.gui
        });
      }
    };

    const debugInterval = setInterval(debugDOM, 2000);
    return () => clearInterval(debugInterval);
  }, []);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        console.log('Starting to load dependencies...');
        
        await loadStyles([
          '/potree/libs/jquery-ui/jquery-ui.min.css',
          '/potree/libs/spectrum/spectrum.css',
          '/potree/libs/jstree/themes/mixed/style.css',
          '/potree/libs/openlayers3/ol.css',
          '/potree/build/potree/potree.css'
        ]);

        const scripts = [
          '/potree/libs/jquery/jquery-3.1.1.min.js',
          '/potree/libs/openlayers3/ol.js',
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
        const container = containerRef.current;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create render area
        const renderArea = document.createElement('div');
        renderArea.id = 'potree_render_area';
        renderArea.style.cssText = `
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          left: 300px;
          overflow: hidden;
          transition: left 0.35s ease;
        `;
        container.appendChild(renderArea);

        // Initialize viewer
        const viewer = new window.Potree.Viewer(renderArea, {
          useDefaultRenderLoop: true,
          pointBudget: 1_000_000,
          fov: 60,
          edlEnabled: true,
          background: 'rgb(32, 32, 32)',
          useEDL: true,
          showStats: false
        });

        viewerRef.current = viewer;
        
        // Let Potree handle GUI initialization
        viewer.loadGUI(() => {
          viewer.setLanguage('en');
          
          // Only modify the map after GUI is loaded
          const sidebarElement = document.getElementById('potree_sidebar_container');
          const mapElement = document.getElementById('potree_map');
          
          if (mapElement && sidebarElement) {
            // Create map section container
            const mapSection = document.createElement('div');
            mapSection.className = 'map-section';
            sidebarElement.insertBefore(mapSection, sidebarElement.firstChild);
            mapSection.appendChild(mapElement);

            // Style adjustments for the map
            mapElement.style.cssText = `
              height: 300px;
              margin: 8px;
              border-radius: 4px;
              overflow: hidden;
              border: 1px solid rgba(255, 255, 255, 0.1);
              background: rgba(0, 0, 0, 0.5);
            `;

            // Initialize OpenLayers map
            try {
              const map = new window.ol.Map({
                target: mapElement,
                layers: [
                  new window.ol.layer.Tile({
                    source: new window.ol.source.OSM()
                  })
                ],
                view: new window.ol.View({
                  center: [0, 0],
                  zoom: 2
                }),
                controls: [
                  new window.ol.control.Zoom(),
                  new window.ol.control.ScaleLine()
                ]
              });

              // Update map on camera change
              viewer.addEventListener('camera_changed', () => {
                const camera = viewer.scene.getActiveCamera();
                const position = camera.position;
                const mapPosition = window.ol.proj.fromLonLat([position.x, position.z]);
                map.getView().setCenter(mapPosition);
              });
            } catch (error) {
              console.error('Error initializing map:', error);
            }
          }
        });

        // Load point cloud
        const publicUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/converted/${project.id}/metadata.json`;
        
        window.Potree.loadPointCloud(publicUrl, project.name || 'point cloud', (e: any) => {
          if (!e?.pointcloud) {
            throw new Error('Invalid point cloud data received');
          }

          viewer.scene.addPointCloud(e.pointcloud);
          setTimeout(() => {
            viewer.fitToScreen();
            setIsLoading(false);
          }, 100);
        });

      } catch (error) {
        console.error('Viewer initialization error:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to initialize viewer');
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        try {
          // Clean up the viewer
          if (viewerRef.current.scene) {
            viewerRef.current.scene.pointclouds.forEach((pointcloud: any) => {
              viewerRef.current.scene.removePointCloud(pointcloud);
            });
            viewerRef.current.scene.dispose();
          }
          
          if (viewerRef.current.renderer) {
            viewerRef.current.renderer.dispose();
          }
          
          delete (window as any).viewer;
          viewerRef.current = null;
          
          // Clean up container
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
    };
  }, [isDependenciesLoaded, project.convertedUrl, project.id, project.name, onError]);

  useEffect(() => {
    // Load custom styles
    const customStyles = document.createElement('link');
    customStyles.rel = 'stylesheet';
    customStyles.href = '/potree-customizations.css';
    document.head.appendChild(customStyles);

    return () => {
      document.head.removeChild(customStyles);
    };
  }, []);

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
    <div className="w-full h-full relative">
      <div 
        ref={containerRef} 
        style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          visibility: isLoading ? 'hidden' : 'visible'
        }}
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