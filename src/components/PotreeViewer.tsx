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

        let lastLogTime = 0;
        const LOG_INTERVAL = 2000; // Log every 2 seconds

        const logNodeDetails = (node: any) => {
          if (!node) {
            console.warn('⚠️ Attempted to log details of null/undefined node');
            return;
          }

          try {
            const details = {
              name: node.name,
              points: null as number | null,
              children: null as string[] | null,
              coordinates: null as any,
              classification: null as any,
              hasGeometry: false,
              geometryDetails: null as any
            };

            try {
              details.points = node.getNumPoints();
            } catch (e) {
              console.warn('⚠️ Failed to get node points:', e);
            }

            try {
              details.children = node.children?.map((c: any) => c.name);
            } catch (e) {
              console.warn('⚠️ Failed to get node children:', e);
            }

            try {
              details.coordinates = node.getBoundingBox();
            } catch (e) {
              console.warn('⚠️ Failed to get node bounding box:', e);
            }

            try {
              details.hasGeometry = !!node.geometryNode?.geometry;
              if (details.hasGeometry) {
                details.geometryDetails = {
                  attributes: Object.keys(node.geometryNode.geometry.attributes),
                  hasClassification: !!node.geometryNode.geometry.attributes.classification
                };
              }
            } catch (e) {
              console.warn('⚠️ Failed to get node geometry details:', e);
            }

            console.log('📋 Node Details:', details);
          } catch (error) {
            console.error('❌ Error in logNodeDetails:', {
              error,
              nodeType: typeof node,
              nodeKeys: Object.keys(node)
            });
          }
        };

        // Add node loading event listener
        viewer.scene.addEventListener('pointcloud_loaded', (e: any) => {
          const pointcloud = e.pointcloud;
          if (pointcloud) {
            pointcloud.addEventListener('node_loaded', (nodeEvent: any) => {
              logNodeDetails(nodeEvent.node);
            });
          }
        });

        viewer.addEventListener('update', () => {
          if (viewer.scene.pointclouds.length > 0) {
            const now = Date.now();
            if (now - lastLogTime >= LOG_INTERVAL) {
              const cloud = viewer.scene.pointclouds[0];
              console.log('📊 Point Cloud State:', {
                totalPoints: cloud.numPoints,
                visibleNodes: cloud.visibleNodes?.length || 0,
                boundingBox: cloud.boundingBox ? {
                  min: cloud.boundingBox.min.toArray(),
                  max: cloud.boundingBox.max.toArray()
                } : null
              });
              lastLogTime = now;

              const visibleNodes = cloud.visibleNodes || [];
              
              console.log('🔍 Visible Nodes Detail:', {
                count: visibleNodes.length,
                nodes: visibleNodes.map((node: any) => ({
                  name: node.name,
                  numPoints: node.getNumPoints?.() || 0,
                  level: node.getLevel?.(),
                  isLoaded: node.isLoaded?.(),
                  boundingBox: node.getBoundingBox?.(),
                  hasGeometry: !!node.geometryNode?.geometry
                }))
              });

              // Log point details for first node as sample
              if (visibleNodes[0]?.geometryNode?.geometry?.attributes?.position) {
                const firstNode = visibleNodes[0];
                const positions = firstNode.geometryNode.geometry.attributes.position;
                console.log('📊 Sample Node Points:', {
                  nodeName: firstNode.name,
                  totalPointsInNode: positions.count,
                  firstFewPoints: Array.from(positions.array.slice(0, 9))
                });
              }
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
          console.log('🎯 LoadPointCloud callback triggered');
          
          const pointcloud = e.pointcloud;
          
          // Set up monitoring BEFORE adding to scene
          monitorLoadedData(pointcloud);
          const cleanup = setupPointCloudMonitoring(pointcloud);

          // Add update event listener
          viewer.addEventListener('update', () => {
            if (viewer.scene.pointclouds.length > 0) {
              const cloud = viewer.scene.pointclouds[0];
              
              // NEW: Track node loading directly
              cloud.visibleNodes.forEach(node => {
                // This gives us direct access to loaded nodes
                if (node.geometryNode?.geometry?.attributes) {
                  console.log('📍 Node Data Available:', {
                    name: node.name,
                    numPoints: node.geometryNode.geometry.attributes.position.count,
                    hasClassification: !!node.geometryNode.geometry.attributes.classification,
                    // NEW: Get actual coordinates
                    coordinates: Array.from(
                      node.geometryNode.geometry.attributes.position.array.slice(0, 9)
                    ).map(x => Number(x).toFixed(2))
                  });
                }
              });

              // NEW: Track material state
              if (cloud.material) {
                console.log('🎨 Material:', {
                  colorType: cloud.material.pointColorType,
                  classification: cloud.material.classification,
                  uniforms: cloud.material.uniforms.classificationLUT?.value 
                    ? 'has classification LUT' 
                    : 'no classification LUT'
                });
              }
            }
          });
          
          console.log('🎯 Pointcloud object:', {
            exists: !!pointcloud,
            pcoGeometry: !!pointcloud?.pcoGeometry,
            root: !!pointcloud?.pcoGeometry?.root
          });

          // Now add to scene and show viewer
          viewer.scene.addPointCloud(pointcloud);
          viewer.fitToScreen();
          setIsLoading(false);
          console.log('✅ Point cloud added to scene and viewer shown');
          
          // Keep the delayed root node inspection
          setTimeout(() => {
            console.log('🎯 Starting state logging after 10s delay');
            
            // Log root node details
            if (pointcloud.pcoGeometry?.root) {
              console.log('🌱 Root node details:', {
                name: pointcloud.pcoGeometry.root.name,
                hasGeometry: !!pointcloud.pcoGeometry.root.geometry,
                hasGeometryNode: !!pointcloud.pcoGeometry.root.geometryNode,
                hasBuffer: !!pointcloud.pcoGeometry.root.geometryNode?.buffer,
                attributes: pointcloud.pcoGeometry.root.geometryNode?.geometry?.attributes ? 
                  Object.keys(pointcloud.pcoGeometry.root.geometryNode.geometry.attributes) : 'no attributes'
              });
            }

            return cleanup;
          }, 10000);
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

    console.log('🏷️ Classification Data:', {
      total: data.metadata?.totalPoints,
      groundPoints: data.classification.ground.length,
      nonGroundPoints: data.classification.nonGround.length,
      sampleGround: data.classification.ground.slice(0, 5),
      sampleNonGround: data.classification.nonGround.slice(0, 5)
    });

    return data;
  };

  // Replace the existing applyGroundSegmentation function
  const applyGroundSegmentation = (pointcloud: any, classification: { ground: number[], nonGround: number[] }) => {
    console.log('🔍 Starting ground segmentation');
    
    // Log root node details immediately
    if (pointcloud.pcoGeometry?.root) {
      logNodeDetails(pointcloud.pcoGeometry.root);
    }
    
    // Log currently visible nodes
    if (pointcloud.visibleNodes) {
      pointcloud.visibleNodes.forEach((node: any) => {
        logNodeDetails(node);
      });
    }

    try {
      // Add node loading monitor
      const nodeLoadMonitor = (e: any) => {
        const node = e.node;
        console.log('📦 Node loaded:', {
          name: node.name,
          level: node.level,
          numPoints: node.numPoints,
          hasGeometry: !!node.geometryNode?.geometry,
          attributes: node.geometryNode?.geometry?.attributes ? 
            Object.keys(node.geometryNode.geometry.attributes) : []
        });
      };

      // Add load listener
      pointcloud.addEventListener('node_loaded', nodeLoadMonitor);

      // Monitor octree state
      console.log('🌳 Octree initial state:', {
        maxLevel: pointcloud.maxLevel,
        loadedNodes: pointcloud.loadedNodes?.size || 0,
        loader: !!pointcloud.loader,
        disposed: pointcloud.disposed,
        initialized: pointcloud.initialized
      });

      // Force node loading if needed
      if (pointcloud.loadedNodes?.size === 0) {
        console.log('⚡ Forcing node load');
        if (pointcloud.loader) {
          // Try to load root node
          const rootNode = pointcloud.pcoGeometry.root;
          if (rootNode) {
            console.log('🌱 Loading root node:', {
              name: rootNode.name,
              level: rootNode.level,
              spacing: rootNode.spacing
            });
            pointcloud.loader.load(rootNode);
          }
        }
      }

      // Monitor visible nodes
      const checkVisibleNodes = () => {
        const visibleNodes = pointcloud.octree?.visibleNodes || [];
        console.log('👁️ Visible nodes:', {
          count: visibleNodes.length,
          loaded: visibleNodes.filter((n: any) => n.loaded).length,
          withGeometry: visibleNodes.filter((n: any) => n.geometryNode?.geometry).length
        });

        // If we have nodes with geometry, apply classification
        if (visibleNodes.some((n: any) => n.geometryNode?.geometry)) {
          visibleNodes.forEach((node: any) => {
            if (node.geometryNode?.geometry?.attributes) {
              console.log('📊 Node attributes:', {
                node: node.name,
                attributes: Object.keys(node.geometryNode.geometry.attributes)
              });
            }
          });

          // Apply classification to visible nodes
          applyClassificationToNodes(pointcloud, visibleNodes, classification);
        }
      };

      // Set up periodic check for nodes
      const nodeCheckInterval = setInterval(checkVisibleNodes, 500);
      setTimeout(() => clearInterval(nodeCheckInterval), 5000);

      // Set up material
      const material = pointcloud.material;
      logMaterialState(material);
      material.needsUpdate = true;

      // Set up uniforms
      const classificationLUT = new Float32Array(256 * 3);
      for (let i = 0; i < 256; i++) {
        classificationLUT[i * 3] = 0.8;     // Default gray
        classificationLUT[i * 3 + 1] = 0.8;
        classificationLUT[i * 3 + 2] = 0.8;
      }
      
      // Ground points in red
      classificationLUT[2 * 3] = 1.0;     // R
      classificationLUT[2 * 3 + 1] = 0.0; // G
      classificationLUT[2 * 3 + 2] = 0.0; // B

      if (material.uniforms.classificationLUT) {
        material.uniforms.classificationLUT.value = classificationLUT;
      }

      logMaterialState(material);

      // Try to force point cloud update
      pointcloud.requiresUpdate = true;
      pointcloud.octree.needsUpdate = true;
      
      return () => {
        pointcloud.removeEventListener('node_loaded', nodeLoadMonitor);
        clearInterval(nodeCheckInterval);
      };

    } catch (error) {
      console.error('❌ Error in ground segmentation:', error);
      throw error;
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
    let cleanupFunction: (() => void) | undefined;
    
    try {
      setIsApplyingSegmentation(true);
      
      const viewer = viewerRef.current;
      if (!viewer?.scene?.pointclouds?.length) {
        throw new Error('No point cloud loaded');
      }

      const pointcloud = viewer.scene.pointclouds[0];

      const logNodeGeometry = (node: any) => {
        console.log('🔍 Node Geometry:', {
          name: node.name,
          numPoints: node.geometryNode?.numPoints,
          attributes: node.geometryNode?.geometry?.attributes ? 
            Object.keys(node.geometryNode.geometry.attributes) : [],
          buffer: node.geometryNode?.buffer ? {
            numPoints: node.geometryNode.buffer.numElements,
            attributes: node.geometryNode.buffer.attributes
          } : null
        });
      };

      // Add node loaded listener
      pointcloud.addEventListener('node_loaded', (e: any) => {
        console.log('📦 Node Loaded:', {
          name: e.node.name,
          level: e.node.getLevel?.(),
          nodeIndex: e.node.index
        });
        logNodeGeometry(e.node);
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

      return () => {
        if (cleanupFunction) cleanupFunction();
      };
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

  // Helper function to apply classification to nodes
  const applyClassificationToNodes = (
    pointcloud: any, 
    nodes: any[], 
    classification: { ground: number[], nonGround: number[] }
  ) => {
    nodes.forEach(node => {
      if (node.geometryNode?.geometry?.attributes) {
        const geometry = node.geometryNode.geometry;
        
        // Create classification attribute if it doesn't exist
        if (!geometry.attributes.classification) {
          const classifications = new Uint8Array(geometry.attributes.position.count);
          classifications.fill(1); // Default non-ground
          
          // Apply ground classifications
          classification.ground.forEach(idx => {
            if (idx < classifications.length) {
              classifications[idx] = 2; // Ground class
            }
          });

          geometry.attributes.classification = new THREE.BufferAttribute(
            classifications,
            1
          );
        }
        
        geometry.attributes.classification.needsUpdate = true;
      }
    });

    // Force material update
    if (pointcloud.material) {
      pointcloud.material.pointColorType = 1; // Try setting to classification mode
      pointcloud.material.needsUpdate = true;
    }
  };

  const getAllPointsOfPointCloud = (pointCloud: any) => {
    try {
      if (!pointCloud?.pcoGeometry?.root?.geometry?.attributes?.position) {
        console.log('❌ Required point cloud structure not found');
        return [];
      }

      const list: THREE.Vector3[] = [];
      const array = pointCloud.pcoGeometry.root.geometry.attributes.position.array;
      const length = pointCloud.pcoGeometry.root.geometry.attributes.position.array.length;

      console.log('📊 Point Cloud Stats:', {
        totalPoints: length / 3,
        hasMatrix: !!pointCloud.matrixWorld
      });

      for (let i = 0; i < length; i += 3) {
        const x = array[i];
        const y = array[i + 1];
        const z = array[i + 2];
        const position = new THREE.Vector3(x, y, z);
        
        if (pointCloud.matrixWorld) {
          position.applyMatrix4(pointCloud.matrixWorld);
        }
        
        list.push(position);

        // Log first few points for debugging
        if (list.length <= 5) {
          console.log(`📍 Point ${list.length}:`, {
            raw: { x, y, z },
            transformed: position.toArray()
          });
        }
      }

      console.log('✅ Successfully extracted points:', {
        count: list.length,
        firstPoint: list[0]?.toArray(),
        lastPoint: list[list.length - 1]?.toArray()
      });

      return list;
    } catch (error) {
      console.error('❌ Error accessing points:', error);
      return [];
    }
  };
  
  const logMaterialState = (material: any) => {
    console.log('🎨 Material state:', {
      vertexColors: material.vertexColors,
      pointColorType: material.pointColorType,
      uniforms: Object.keys(material.uniforms || {})
    });
  };

  const monitorLoadedData = (pointcloud: any) => {
    console.log('🔍 Setting up monitoring for pointcloud:', {
      hasPointcloud: !!pointcloud,
      type: pointcloud?.type,
      hasEventListener: typeof pointcloud?.addEventListener === 'function'
    });

    try {
      // Watch for octree events
      pointcloud?.addEventListener?.('octree_initialized', (e: any) => {
        console.log('🌳 Octree initialized:', {
          maxPoints: pointcloud?.numPoints,
          loadedNodes: pointcloud?.loadedNodes?.size,
          event: e
        });
      });

      console.log('✅ Added octree_initialized listener');

      // Watch for actual data loading
      pointcloud?.addEventListener?.('points_loaded', (e: any) => {
        console.log('📦 Node data loaded:', {
          hasNode: !!e?.node,
          name: e?.node?.name,
          buffer: e?.node?.geometryNode?.buffer ? {
            size: e?.node?.geometryNode?.buffer?.data?.byteLength,
            numElements: e?.node?.geometryNode?.buffer?.numElements,
            stride: e?.node?.geometryNode?.buffer?.stride,
            attributes: Object.keys(e?.node?.geometryNode?.buffer?.attributes || {})
          } : 'no buffer',
          rawEvent: e
        });
      });

      console.log('✅ Added points_loaded listener');

      // Immediate inspection of pointcloud state
      console.log('📊 Current pointcloud state:', {
        numPoints: pointcloud?.numPoints,
        loadedNodes: pointcloud?.loadedNodes?.size,
        octreeInitialized: pointcloud?.octreeInitialized,
        available: {
          hasOctree: !!pointcloud?.octree,
          hasGeometry: !!pointcloud?.geometry,
          hasBuffer: !!pointcloud?.geometry?.attributes?.position?.array
        }
      });

    } catch (error) {
      console.error('❌ Error in monitorLoadedData:', {
        error,
        pointcloudState: {
          type: typeof pointcloud,
          keys: Object.keys(pointcloud || {}),
          prototype: Object.getPrototypeOf(pointcloud)
        }
      });
    }
  };

  const setupPointCloudMonitoring = (pointcloud: any) => {
    console.log('🔍 Setting up monitoring for pointcloud:', {
      hasPointcloud: !!pointcloud,
      type: pointcloud?.type,
      hasEventListener: typeof pointcloud?.addEventListener === 'function'
    });

    let nodeCheckInterval: NodeJS.Timeout;
    
    const monitorNodes = () => {
      const visibleNodes = pointcloud.visibleNodes || [];
      console.log('👁️ Visible Nodes Update:', {
        count: visibleNodes.length,
        nodes: visibleNodes.map((node: any) => ({
          name: node.name,
          level: node.level,
          numPoints: node.getNumPoints?.() || 0,
          hasGeometry: !!node.geometryNode?.geometry
        }))
      });

      // If we have nodes and haven't cleared the interval, do so
      if (visibleNodes.length > 0 && nodeCheckInterval) {
        console.log('✅ Nodes successfully loaded, clearing monitor');
        clearInterval(nodeCheckInterval);
      }
    };

    // Set up event listeners
    pointcloud.addEventListener('octree_initialized', (e: any) => {
      console.log('🌳 Octree initialized:', {
        maxPoints: pointcloud.numPoints,
        loadedNodes: pointcloud.loadedNodes?.size || 0,
        event: e
      });
      
      // Start monitoring after octree is initialized
      nodeCheckInterval = setInterval(monitorNodes, 500);
      
      // Safety cleanup after 10 seconds
      setTimeout(() => {
        if (nodeCheckInterval) {
          console.log('⚠️ Safety cleanup of node monitor');
          clearInterval(nodeCheckInterval);
        }
      }, 10000);
    });

    // Monitor individual node loading
    pointcloud.addEventListener('node_loaded', (e: any) => {
      const node = e.node;
      console.log('📦 Node loaded:', {
        name: node.name,
        level: node.level,
        numPoints: node.getNumPoints?.() || 0,
        hasGeometry: !!node.geometryNode?.geometry,
        geometryDetails: node.geometryNode?.geometry ? {
          attributes: Object.keys(node.geometryNode.geometry.attributes),
          numPoints: node.geometryNode.geometry.attributes.position?.count
        } : null
      });
    });

    // Monitor points loading
    pointcloud.addEventListener('points_loaded', () => {
      console.log('📊 Points loaded update:', {
        totalPoints: pointcloud.numPoints,
        visibleNodes: pointcloud.visibleNodes?.length || 0,
        loadedNodes: pointcloud.loadedNodes?.size || 0
      });
    });

    return () => {
      if (nodeCheckInterval) {
        clearInterval(nodeCheckInterval);
      }
    };
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