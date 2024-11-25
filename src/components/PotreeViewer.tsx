import { useEffect, useRef, useState } from 'react';
import { Project } from '@/types/project';
import { getAuth } from 'firebase/auth';

declare const THREE: any;

interface PotreeViewerProps {
  project: Project;
  onError?: (error: string) => void;
}

interface GroundSegmentationData {
  success: boolean;
  metadata: {
    totalPoints: number;
    groundPoints: number;
    nonGroundPoints: number;
  };
  classification: {
    ground: number[];
    nonGround: number[];
  };
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

  const fetchGroundSegmentationData = async () => {
    console.log('🔍 Fetching ground segmentation for:', project.id);
    
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `/api/projects/${project.id}/ground-classification`;
    console.log('🔍 Fetching from:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Fetch error:', errorData);
      throw new Error(`Failed to fetch ground segmentation: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.classification?.ground) {
      console.error('❌ Invalid response data:', data);
      throw new Error('Invalid ground segmentation data');
    }

    console.log('✅ Received classification data:', {
      groundPoints: data.classification.ground.length,
      nonGroundPoints: data.classification.nonGround.length
    });

    return data;
  };

  const applyGroundSegmentation = (pointcloud: any, classification: { ground: number[], nonGround: number[] }) => {
    console.log('🔍 Starting ground segmentation with:', {
      totalGroundPoints: classification.ground.length,
      totalNonGroundPoints: classification.nonGround.length
    });

    // Get the proper Potree namespace
    const Potree = (window as any).Potree;
    if (!Potree) {
      throw new Error('Potree not initialized');
    }

    // 1. First, ensure we have the correct point count
    const totalPoints = classification.ground.length + classification.nonGround.length;
    console.log('📊 Setting up classification for', totalPoints, 'points');

    // 2. Set up color values (using Potree's internal format)
    const colors = {
      nonGround: { r: 0.8, g: 0.8, b: 0.8 }, // Gray
      ground: { r: 1.0, g: 0.0, b: 0.0 }     // Red
    };

    // 3. Create RGB attributes for each point
    const rgbArray = new Float32Array(totalPoints * 3);
    
    // Fill with default color (non-ground)
    for (let i = 0; i < totalPoints; i++) {
      rgbArray[i * 3] = colors.nonGround.r;
      rgbArray[i * 3 + 1] = colors.nonGround.g;
      rgbArray[i * 3 + 2] = colors.nonGround.b;
    }

    // Set ground point colors
    console.log('🎨 Applying ground point colors...');
    let appliedColors = 0;
    classification.ground.forEach(index => {
      if (index < totalPoints) {
        rgbArray[index * 3] = colors.ground.r;
        rgbArray[index * 3 + 1] = colors.ground.g;
        rgbArray[index * 3 + 2] = colors.ground.b;
        appliedColors++;
      }
    });
    
    console.log(`✅ Applied colors to ${appliedColors} ground points`);

    try {
      // Method 1: Try using Potree's built-in color attribute
      if (pointcloud.geometry && pointcloud.geometry.attributes) {
        console.log('📊 Using geometry attributes method');
        pointcloud.geometry.attributes.color = new THREE.BufferAttribute(rgbArray, 3);
        pointcloud.geometry.attributes.color.needsUpdate = true;
      }
      // Method 2: Try using Potree's material system
      else if (pointcloud.material) {
        console.log('📊 Using material method');
        pointcloud.material.vertexColors = true;
        pointcloud.material.color = new THREE.Color(1, 1, 1);
        
        // Set custom vertex colors
        if (pointcloud.pcoGeometry && pointcloud.pcoGeometry.vertices) {
          console.log('📊 Setting vertex colors');
          pointcloud.pcoGeometry.vertices.forEach((vertex: any, i: number) => {
            vertex.color = new THREE.Color(
              rgbArray[i * 3],
              rgbArray[i * 3 + 1],
              rgbArray[i * 3 + 2]
            );
          });
        }
      }

      // Update material
      pointcloud.material.needsUpdate = true;

      // Force viewer update
      console.log('🔄 Triggering scene update');
      viewerRef.current?.scene.dispatchEvent({
        type: 'material_changed',
        target: pointcloud
      });

      console.log('✅ Color application complete');

    } catch (error) {
      console.error('❌ Error applying colors:', error);
      throw new Error('Failed to apply colors: ' + (error as Error).message);
    }
  };

  const resetVisualization = (pointcloud: any) => {
    console.log('🔄 Resetting visualization');
    
    try {
      if (pointcloud.geometry?.attributes?.color) {
        // Reset to default color
        const defaultColor = new Float32Array(pointcloud.geometry.attributes.color.count * 3).fill(1);
        pointcloud.geometry.attributes.color.array = defaultColor;
        pointcloud.geometry.attributes.color.needsUpdate = true;
      }
      
      if (pointcloud.material) {
        pointcloud.material.vertexColors = false;
        pointcloud.material.color = new THREE.Color(1, 1, 1);
        pointcloud.material.needsUpdate = true;
      }

      // Update scene
      viewerRef.current?.scene.dispatchEvent({
        type: 'material_changed',
        target: pointcloud
      });

      console.log('✅ Reset complete');
    } catch (error) {
      console.error('❌ Reset error:', error);
      throw new Error('Failed to reset visualization: ' + (error as Error).message);
    }
  };

  const toggleGroundSegmentation = async () => {
    console.log('🔄 Starting ground segmentation toggle');
    
    try {
      setIsApplyingSegmentation(true);
      
      const viewer = viewerRef.current;
      if (!viewer?.scene?.pointclouds?.length) {
        throw new Error('No point cloud loaded');
      }

      const pointcloud = viewer.scene.pointclouds[0];
      console.log('📊 Point cloud state:', {
        pcoGeometry: !!pointcloud.pcoGeometry,
        numPoints: pointcloud.pcoGeometry?.numPoints,
        material: !!pointcloud.material
      });

      if (isGroundSegmentationActive) {
        console.log('🔄 Deactivating ground segmentation');
        resetVisualization(pointcloud);
        setIsGroundSegmentationActive(false);
      } else {
        console.log('🔄 Activating ground segmentation');
        const data = await fetchGroundSegmentationData();
        
        if (!data.success || !data.classification?.ground) {
          throw new Error('Invalid segmentation data');
        }

        await applyGroundSegmentation(pointcloud, data.classification);
        setIsGroundSegmentationActive(true);
      }
    } catch (error) {
      console.error('Ground segmentation error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to toggle ground segmentation');
    } finally {
      setIsApplyingSegmentation(false);
    }
  };

  // Add tool to toolbar
  useEffect(() => {
    if (!viewerRef.current || !isDependenciesLoaded) return;

    const toolbar = document.getElementById('tools');
    if (!toolbar) return;

    const button = document.createElement('div');
    button.className = `potree_button_toggle ${isGroundSegmentationActive ? 'active' : ''}`;
    button.style.cursor = isApplyingSegmentation ? 'wait' : 'pointer';
    button.innerHTML = `
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 24 24" 
        style="${isApplyingSegmentation ? 'opacity: 0.5;' : ''}"
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
      >
        <path d="M3 21h18M3 18h18M5 15l7-12 7 12H5z" />
      </svg>
    `;
    
    button.onclick = toggleGroundSegmentation;
    toolbar.appendChild(button);

    return () => {
      toolbar.removeChild(button);
    };
  }, [isDependenciesLoaded, isGroundSegmentationActive, isApplyingSegmentation]);

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