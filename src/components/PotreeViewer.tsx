import { useEffect, useRef, useState } from 'react';
import { Project } from '@/types/project';
import { getAuth } from 'firebase/auth';

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
  const [isGroundSegmentationActive, setIsGroundSegmentationActive] = useState(false);
  const [isApplyingSegmentation, setIsApplyingSegmentation] = useState(false);

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
        const container = containerRef.current;
        if (!container) return;
        
        container.innerHTML = '';
        
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

        const viewer = new window.Potree.Viewer(renderArea, {
          useDefaultRenderLoop: true,
          pointBudget: 1_000_000,
          fov: 60,
          edlEnabled: true,
          background: 'rgb(32, 32, 32)',
          useEDL: true,
          showStats: false,
          freeze: false
        });

        (window as any).viewer = viewer;
        
        viewerRef.current = viewer;

        viewer.addEventListener('update', () => {
          if (viewer.scene.pointclouds.length > 0) {
            const cloud = viewer.scene.pointclouds[0];
            if (cloud && !cloud.hierarchyInitialized) {
              cloud.hierarchyInitialized = true;
            }
          }
        });

        viewer.toggleSidebar = () => {
          const renderArea = document.getElementById('potree_render_area');
          const sidebar = document.getElementById('potree_sidebar_container');
          
          if (renderArea && sidebar) {
            const isVisible = renderArea.style.left !== '0px';
            
            renderArea.style.left = isVisible ? '0px' : '300px';
            sidebar.style.transform = isVisible ? 
              'translateX(-300px)' : 'translateX(0)';
            sidebar.style.transition = 'transform 0.35s ease';
          }
        };

        viewer.loadGUI(() => {
          viewer.setLanguage('en');
          
          const sidebar = document.getElementById('potree_sidebar_container');
          if (sidebar) {
            sidebar.style.cssText = `
              position: absolute;
              left: 0;
              top: 0;
              bottom: 0;
              width: 300px;
              background-color: rgba(0, 0, 0, 0.8);
              z-index: 10;
              overflow-y: auto;
              transition: transform 0.35s ease;
            `;
          }

          // Add menu toggle styling
          const menuToggle = document.querySelector('.potree_menu_toggle');
          if (menuToggle) {
            const imgElement = menuToggle.querySelector('img');
            if (imgElement) {
              imgElement.style.cssText = `
                width: 24px;
                height: 24px;
                padding: 4px;
                margin: 4px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
                cursor: pointer;
              `;
            }
          }

          // Add Ground Segmentation Tool
          const elToolbar = $('#tools');
          
          // Add ground segmentation button
          elToolbar.append(createToolIcon(
            '/icons/ground.svg',
            'Ground Segmentation',
            toggleGroundSegmentation
          ));
        });

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
          // Proper cleanup for Potree viewer
          const viewer = viewerRef.current;
          if (viewer.scene) {
            // Remove all point clouds
            viewer.scene.pointclouds.forEach((pointcloud: any) => {
              viewer.scene.removePointCloud(pointcloud);
            });
          }
          // Remove event listeners
          viewer.removeEventListeners();
          
          // Clear the reference
          viewerRef.current = null;
          delete (window as any).viewer;
        } catch (error) {
          console.warn('Error during viewer cleanup:', error);
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

  // Helper function to create tool icons
  const createToolIcon = (icon: string, title: string, callback: () => void) => {
    const element = $(`
      <img src="${icon}"
        style="width: 32px; height: 32px"
        class="button-icon ${isGroundSegmentationActive ? 'active-tool' : ''}"
        data-i18n="${title}" />
    `);

    // Add loading state visual
    if (isApplyingSegmentation) {
      element.css('opacity', '0.5');
      element.css('cursor', 'wait');
    }

    element.click(callback);
    return element;
  };

  const getAuthToken = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user.getIdToken();
  };

  const toggleGroundSegmentation = async () => {
    console.log('Ground segmentation tool clicked, current state:', !isGroundSegmentationActive);
    
    const pointcloud = viewer.scene.pointclouds[0];
    if (!pointcloud) {
      console.error('No point cloud available');
      return;
    }

    if (isGroundSegmentationActive) {
      console.log('Deactivating ground segmentation...');
      
      // Reset visualization
      pointcloud.material.pointColorType = window.Potree.PointColorType.RGB;
      pointcloud.material.activeAttributeName = null;
      
      // Reset material classifications
      pointcloud.material.uniforms.classificationLUT.value = [];
      
      viewer.scene.dispatchEvent({
        type: 'material_changed',
        target: pointcloud
      });

      setIsGroundSegmentationActive(false);
      
    } else {
      try {
        console.log('Activating ground segmentation...');
        setIsApplyingSegmentation(true);

        const response = await fetch(`/api/projects/${project.id}/ground-classification`, {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        });
        
        const data = await response.json();
        
        if (!data.classification) {
          throw new Error('No ground classification data found');
        }

        console.log('Received classification data:', {
          groundPoints: data.classification.ground.length,
          total: pointcloud.numPoints
        });

        // Set up custom classification coloring
        const classificationColors = new Float32Array(256 * 3);
        // Set default color (gray) for all classes
        for (let i = 0; i < 256; i++) {
          classificationColors[i * 3] = 0.6;  // R
          classificationColors[i * 3 + 1] = 0.6;  // G
          classificationColors[i * 3 + 2] = 0.6;  // B
        }
        
        // Set ground points color (red)
        classificationColors[0] = 1.0;  // R
        classificationColors[1] = 0.0;  // G
        classificationColors[2] = 0.0;  // B

        // Update material settings
        pointcloud.material.pointColorType = window.Potree.PointColorType.CLASSIFICATION;
        pointcloud.material.uniforms.classificationLUT.value = classificationColors;

        // Apply classifications
        console.log('Applying classifications to points...');
        data.classification.ground.forEach((index: number) => {
          pointcloud.setClassification(index, 0); // Set ground points to class 0
        });

        viewer.scene.dispatchEvent({
          type: 'material_changed',
          target: pointcloud
        });

        setIsGroundSegmentationActive(true);
        console.log('Ground segmentation activated successfully');

      } catch (error) {
        console.error('Error applying ground segmentation:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to apply ground segmentation');
      } finally {
        setIsApplyingSegmentation(false);
      }
    }
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