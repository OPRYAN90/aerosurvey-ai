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
    console.log('🔍 Starting ground segmentation application');

    // Log initial point cloud state
    console.log('📊 Point Cloud Initial State:', {
      geometry: {
        exists: !!pointcloud.geometry,
        attributes: pointcloud.geometry?.attributes ? Object.keys(pointcloud.geometry.attributes) : [],
        vertexCount: pointcloud.geometry?.attributes?.position?.count || 'N/A'
      },
      pcoGeometry: {
        exists: !!pointcloud.pcoGeometry,
        pointCount: pointcloud.pcoGeometry?.pointAttributes?.size || 'N/A',
        spacing: pointcloud.pcoGeometry?.spacing || 'N/A',
        attributes: pointcloud.pcoGeometry?.pointAttributes?.attributes?.map((a: any) => a.name) || []
      },
      material: {
        type: pointcloud.material?.type,
        uniformKeys: Object.keys(pointcloud.material?.uniforms || {}),
        currentPointColorType: pointcloud.material?.pointColorType,
        hasClassificationLUT: !!pointcloud.material?.uniforms?.classificationLUT
      }
    });

    try {
      // Since we have classificationLUT uniform but it's not initialized
      const classificationColors = new Float32Array(256 * 3);  // RGB for 256 possible classes
      
      // Log classification input
      console.log('📥 Classification Input:', {
        groundPointsCount: classification.ground.length,
        nonGroundPointsCount: classification.nonGround.length,
        groundPointsSample: classification.ground.slice(0, 5),
        maxGroundIndex: Math.max(...classification.ground),
        minGroundIndex: Math.min(...classification.ground)
      });
      
      // Set default color for all classes (gray)
      for (let i = 0; i < 256; i++) {
        classificationColors[i * 3] = 0.8;     // R
        classificationColors[i * 3 + 1] = 0.8; // G
        classificationColors[i * 3 + 2] = 0.8; // B
      }

      // Set ground class color (red)
      const GROUND_CLASS = 2;  // Use class 2 for ground
      classificationColors[GROUND_CLASS * 3] = 1.0;     // R
      classificationColors[GROUND_CLASS * 3 + 1] = 0.0; // G
      classificationColors[GROUND_CLASS * 3 + 2] = 0.0; // B

      console.log('🎨 Classification Colors:', {
        totalColors: classificationColors.length / 3,
        groundClassColor: [
          classificationColors[GROUND_CLASS * 3],
          classificationColors[GROUND_CLASS * 3 + 1],
          classificationColors[GROUND_CLASS * 3 + 2]
        ],
        defaultColor: [
          classificationColors[0],
          classificationColors[1],
          classificationColors[2]
        ]
      });

      // Create classification array
      const classifications = new Uint8Array(pointcloud.pcoGeometry.pointAttributes.size).fill(1);
      
      // Log initial classification array state
      console.log('📊 Classifications Array:', {
        totalSize: classifications.length,
        initialValue: classifications[0],
        byteLength: classifications.byteLength,
        type: classifications.constructor.name
      });
      
      // Mark ground points
      let appliedPoints = 0;
      let outOfBoundsPoints = 0;
      classification.ground.forEach(index => {
        if (index < classifications.length) {
          classifications[index] = GROUND_CLASS;
          appliedPoints++;
        } else {
          outOfBoundsPoints++;
        }
      });

      console.log('✅ Ground Points Application:', {
        successful: appliedPoints,
        outOfBounds: outOfBoundsPoints,
        totalAttempted: classification.ground.length,
        classificationsSample: Array.from(classifications.slice(0, 10))
      });

      // Apply to material
      if (pointcloud.material.uniforms.classificationLUT) {
        console.log('🎨 Material Uniforms State:', {
          beforeUpdate: {
            classificationLUTSize: pointcloud.material.uniforms.classificationLUT.value?.length,
            hasClassification: !!pointcloud.material.uniforms.classification,
            currentPointColorType: pointcloud.material.pointColorType
          }
        });

        pointcloud.material.uniforms.classificationLUT.value = classificationColors;
        
        // Set classification data
        if (pointcloud.material.uniforms.classification) {
          pointcloud.material.uniforms.classification.value = classifications;
          console.log('✅ Applied via uniforms');
        } else {
          console.log('⚠️ No classification uniform, trying geometry attributes');
          if (pointcloud.geometry?.attributes) {
            const attribute = new THREE.BufferAttribute(classifications, 1);
            pointcloud.geometry.attributes.classification = attribute;
            console.log('✅ Applied via geometry attributes');
          }
        }

        // Force point color type to classification
        if ('pointColorType' in pointcloud.material) {
          pointcloud.material.pointColorType = 1;  // Assume 1 is classification type
        }
        
        // Log final material state
        console.log('🎨 Final Material State:', {
          pointColorType: pointcloud.material.pointColorType,
          classificationLUTSize: pointcloud.material.uniforms.classificationLUT.value.length,
          hasClassificationUniform: !!pointcloud.material.uniforms.classification,
          hasGeometryClassification: !!pointcloud.geometry?.attributes?.classification
        });

        // Update material
        pointcloud.material.needsUpdate = true;

        // Force octree update if available
        if (pointcloud.octree) {
          const visibleNodesCount = pointcloud.octree.visibleNodes?.length || 0;
          console.log('🌳 Updating Octree:', {
            visibleNodes: visibleNodesCount,
            maxLevel: pointcloud.octree.maxLevel
          });

          pointcloud.octree.visibleNodes.forEach((node: any) => {
            if (node.geometryNode) {
              node.geometryNode.dispose();
              node.geometryNode = null;
            }
          });
        }

        // Dispatch update event
        console.log('🔄 Triggering scene update');
        viewerRef.current?.scene.dispatchEvent({
          type: 'material_changed',
          target: pointcloud
        });
      } else {
        console.warn('⚠️ No classificationLUT uniform found in material:', {
          availableUniforms: Object.keys(pointcloud.material.uniforms || {})
        });
      }

      console.log('✅ Ground segmentation applied');

    } catch (error) {
      console.error('❌ Error applying ground segmentation:', error);
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

  const inspectPointCloud = (pointcloud: any) => {
    console.log('🔍 Detailed Point Cloud Inspection');

    // 1. Inspect root node structure
    console.log('📊 Root Node:', {
      boundingBox: pointcloud.boundingBox,
      position: pointcloud.position.toArray(),
      scale: pointcloud.scale.toArray(),
      root: pointcloud.pcoGeometry?.root
    });

    // 2. Inspect material attributes
    const material = pointcloud.material;
    console.log('🎨 Material Details:', {
      shaderType: material.type,
      availableUniforms: Object.fromEntries(
        Object.entries(material.uniforms || {})
          .map(([key, value]: [string, any]) => [key, value?.value])
      ),
      hasVertexColors: material.vertexColors,
      availableAttributes: material.attributes
    });

    // 3. Try to access points through octree
    if (pointcloud.octree) {
      const visibleNodes = pointcloud.octree.visibleNodes || [];
      console.log('🌳 Octree Data:', {
        totalNodes: visibleNodes.length,
        firstNode: visibleNodes[0] && {
          numPoints: visibleNodes[0].numPoints,
          name: visibleNodes[0].name,
          level: visibleNodes[0].level,
          index: visibleNodes[0].index,
          hasGeometry: !!visibleNodes[0].geometryNode
        }
      });

      // 4. Try to get point data from first visible node
      const firstNode = visibleNodes[0];
      if (firstNode?.geometryNode?.geometry) {
        const geometry = firstNode.geometryNode.geometry;
        console.log('📍 Node Geometry Data:', {
          attributes: Object.keys(geometry.attributes),
          positionArray: geometry.attributes.position?.array.slice(0, 9),  // First 3 points
          colorArray: geometry.attributes.color?.array.slice(0, 9),
          classificationArray: geometry.attributes.classification?.array.slice(0, 3)
        });
      }
    }

    // 5. Check point attributes
    if (pointcloud.pcoGeometry?.pointAttributes) {
      const attrs = pointcloud.pcoGeometry.pointAttributes;
      console.log('📊 Point Attributes:', {
        size: attrs.size,
        attributes: attrs.attributes,
        byteSize: attrs.byteSize,
        listAttributes: Object.keys(attrs)
      });
    }

    // 6. Try to access the point data buffer
    if (pointcloud.geometry?.attributes) {
      const attributes = pointcloud.geometry.attributes;
      console.log('📈 Geometry Attributes:', {
        position: attributes.position?.array.slice(0, 9),
        color: attributes.color?.array.slice(0, 9),
        classification: attributes.classification?.array.slice(0, 3)
      });
    }

    // 7. Check for point buffer in pcoGeometry
    if (pointcloud.pcoGeometry?.vertices) {
      console.log('📍 PCO Vertices:', {
        first3Points: pointcloud.pcoGeometry.vertices.slice(0, 3)
      });
    }

    // 8. Inspect node structure if available
    if (pointcloud.pcoGeometry?.nodes) {
      interface PotreeNode {
        name: string;
        numPoints: number;
        level: number;
        geometryNode: any;
      }
      
      const nodes = Array.from(pointcloud.pcoGeometry.nodes.values()) as PotreeNode[];
      console.log('🌳 Node Structure:', nodes.slice(0, 3).map(node => ({
        name: node.name,
        numPoints: node.numPoints,
        level: node.level,
        hasGeometry: !!node.geometryNode
      })));
    }
  };

  const inspectPointCloudStructure = (pointcloud: any) => {
    // 1. Inspect boundingBox
    if (pointcloud.boundingBox) {
      console.log('📦 Bounding Box:', {
        min: pointcloud.boundingBox.min.toArray(),
        max: pointcloud.boundingBox.max.toArray(),
        size: {
          x: pointcloud.boundingBox.max.x - pointcloud.boundingBox.min.x,
          y: pointcloud.boundingBox.max.y - pointcloud.boundingBox.min.y,
          z: pointcloud.boundingBox.max.z - pointcloud.boundingBox.min.z
        }
      });
    }

    // 2. Inspect root node structure
    if (pointcloud.pcoGeometry?.root) {
      const root = pointcloud.pcoGeometry.root;
      console.log('🌳 Root Node Details:', {
        name: root.name,
        level: root.level,
        spacing: root.spacing,
        hasChildren: root.hasChildren(),
        childrenNames: root.children?.map((c: any) => c.name) || [],
        boundingBox: {
          min: root.boundingBox?.min.toArray(),
          max: root.boundingBox?.max.toArray()
        }
      });

      // 3. Inspect first child if exists
      if (root.children?.[0]) {
        const firstChild = root.children[0];
        console.log('👶 First Child Node:', {
          name: firstChild.name,
          level: firstChild.level,
          spacing: firstChild.spacing,
          hasGeometry: !!firstChild.geometry,
          attributes: firstChild.geometry?.attributes ? 
            Object.keys(firstChild.geometry.attributes) : []
        });
      }
    }

    // 4. Detailed material inspection
    if (pointcloud.material) {
      console.log('🎨 Detailed Material:', {
        // Basic properties
        type: pointcloud.material.type,
        vertexColors: pointcloud.material.vertexColors,
        
        // Available uniforms with their current values
        uniforms: Object.fromEntries(
          Object.entries(pointcloud.material.uniforms || {})
            .map(([key, value]: [string, any]) => [
              key, 
              value?.value instanceof Float32Array ? 
                Array.from(value.value).slice(0, 5) + '...' : 
                value?.value
            ])
        ),
        
        // Available attributes
        attributes: Object.keys(pointcloud.material.attributes || {}),
        
        // Point size settings
        size: pointcloud.material.size,
        pointSizeType: pointcloud.material.pointSizeType,
        
        // Color settings
        pointColorType: pointcloud.material.pointColorType,
        gradient: pointcloud.material.gradient,
        
        // Classification settings
        classification: pointcloud.material.classification ? {
          length: pointcloud.material.classification.length,
          sample: Array.from(pointcloud.material.classification).slice(0, 5)
        } : null
      });
    }

    // 5. Inspect point attributes structure
    if (pointcloud.pcoGeometry?.pointAttributes) {
      const attrs = pointcloud.pcoGeometry.pointAttributes;
      console.log('📊 Point Attributes Detail:', {
        listAttributes: attrs.listAttributes().map((attr: any) => ({
          name: attr.name,
          size: attr.byteSize,
          elements: attr.elements,
          elementSize: attr.elementSize
        })),
        byteSize: attrs.byteSize,
        size: attrs.size,
        attributeMap: Object.fromEntries(
          Object.entries(attrs.attributes || {})
            .map(([key, value]: [string, any]) => [
              key,
              {
                name: value.name,
                size: value.byteSize,
                elements: value.elements
              }
            ])
        )
      });
    }
    
    // 6. Try to access point data
    const getPointSample = () => {
      // Try different methods to access points
      const methods = {
        // Try through octree
        octree: pointcloud.octree?.visibleNodes?.[0]?.geometryNode?.geometry?.attributes,
        // Try through geometry
        geometry: pointcloud.geometry?.attributes,
        // Try through pcoGeometry
        pcoGeometry: pointcloud.pcoGeometry?.vertices,
        // Try through buffer geometry
        buffer: pointcloud.bufferGeometry?.attributes
      };

      console.log('📍 Point Access Methods:', {
        availableMethods: Object.entries(methods)
          .map(([key, value]) => [key, !!value])
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
      });

      // Log sample from first available method
      for (const [method, data] of Object.entries(methods)) {
        if (data) {
          console.log(`📍 Sample Points (via ${method}):`, {
            position: data.position?.array.slice(0, 9),
            color: data.color?.array.slice(0, 9),
            classification: data.classification?.array.slice(0, 3)
          });
          break;
        }
      }
    };

    getPointSample();
  };

  const inspectPointCloudData = (pointcloud: any) => {
    console.log('🔍 Starting point cloud inspection');

    // Try to get point coordinates through different methods
    console.log('📍 Attempting to access point coordinates...');

    // Method 1: Through geometry attributes
    if (pointcloud.geometry?.attributes?.position) {
      const positions = pointcloud.geometry.attributes.position;
      console.log('📍 Points via Geometry:', {
        count: positions.count,
        itemSize: positions.itemSize,
        firstTenPoints: Array.from(positions.array.slice(0, 30)).reduce((acc, val, i) => {
          const pointIndex = Math.floor(i / 3);
          if (!acc[pointIndex]) acc[pointIndex] = [];
          acc[pointIndex].push(val);
          return acc;
        }, [] as number[][])
      });
    }

    // Method 2: Through PCO Geometry
    if (pointcloud.pcoGeometry?.vertices) {
      console.log('📍 Points via PCO Geometry:', {
        firstTenVertices: pointcloud.pcoGeometry.vertices
          .slice(0, 10)
          .map((v: any) => ({
            x: v.x,
            y: v.y,
            z: v.z
          }))
      });
    }

    // Method 3: Through octree nodes
    if (pointcloud.octree?.visibleNodes?.[0]?.geometryNode?.geometry?.attributes?.position) {
      const nodePositions = pointcloud.octree.visibleNodes[0].geometryNode.geometry.attributes.position;
      console.log('📍 Points via Octree Node:', {
        nodeLevel: pointcloud.octree.visibleNodes[0].level,
        count: nodePositions.count,
        firstTenPoints: Array.from(nodePositions.array.slice(0, 30)).reduce((acc, val, i) => {
          const pointIndex = Math.floor(i / 3);
          if (!acc[pointIndex]) acc[pointIndex] = [];
          acc[pointIndex].push(val);
          return acc;
        }, [] as number[][])
      });
    }

    // Method 4: Through buffer geometry
    if (pointcloud.bufferGeometry?.attributes?.position) {
      const bufferPositions = pointcloud.bufferGeometry.attributes.position;
      console.log('📍 Points via Buffer Geometry:', {
        count: bufferPositions.count,
        firstTenPoints: Array.from(bufferPositions.array.slice(0, 30)).reduce((acc, val, i) => {
          const pointIndex = Math.floor(i / 3);
          if (!acc[pointIndex]) acc[pointIndex] = [];
          acc[pointIndex].push(val);
          return acc;
        }, [] as number[][])
      });
    }

    // Try to access point colors
    if (pointcloud.geometry?.attributes?.color) {
      const colors = pointcloud.geometry.attributes.color;
      console.log('🎨 Point Colors:', {
        count: colors.count,
        firstTenColors: Array.from(colors.array.slice(0, 30)).reduce((acc, val, i) => {
          const colorIndex = Math.floor(i / 3);
          if (!acc[colorIndex]) acc[colorIndex] = [];
          acc[colorIndex].push(val);
          return acc;
        }, [] as number[][])
      });
    }

    // Try to access point classifications if they exist
    if (pointcloud.geometry?.attributes?.classification) {
      const classifications = pointcloud.geometry.attributes.classification;
      console.log('🏷️ Point Classifications:', {
        count: classifications.count,
        firstTenClassifications: Array.from(classifications.array.slice(0, 10))
      });
    }

    // Log bounding box if available
    if (pointcloud.boundingBox) {
      console.log('📦 Bounding Box:', {
        min: {
          x: pointcloud.boundingBox.min.x,
          y: pointcloud.boundingBox.min.y,
          z: pointcloud.boundingBox.min.z
        },
        max: {
          x: pointcloud.boundingBox.max.x,
          y: pointcloud.boundingBox.max.y,
          z: pointcloud.boundingBox.max.z
        }
      });
    }

    // Rest of your existing inspection code...
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
      
      // Run our simplified inspection
      inspectPointCloudData(pointcloud);

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