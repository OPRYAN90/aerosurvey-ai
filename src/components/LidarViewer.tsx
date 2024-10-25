"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { storage } from '@/lib/firebase'
import { ref, getBlob } from 'firebase/storage'
import { LASLoader } from '@loaders.gl/las'
import { load } from '@loaders.gl/core'

interface LidarViewerProps {
  fileUrl: string;
  onError?: (error: string) => void;
}

interface LoadingState {
  isLoading: boolean;
  progress: number;
  error: string | null;
}

interface ViewerControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  toggleFullscreen: () => void;
}

interface ThreeContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  pointCloud: THREE.Points | null;
  dispose: () => void;
}

function useThreeContext(containerRef: React.RefObject<HTMLDivElement>): ThreeContext | null {
  const [context, setContext] = useState<ThreeContext | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    console.log('Creating Three.js context')
    
    // Create scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000
    )
    camera.position.set(0, 5, 10)

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = true
    controls.minDistance = 0.1
    controls.maxDistance = 1000

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
    scene.add(gridHelper)

    // Create animation loop
    let animationFrameId: number

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // Create context
    const ctx: ThreeContext = {
      scene,
      camera,
      renderer,
      controls,
      pointCloud: null,
      dispose: () => {
        cancelAnimationFrame(animationFrameId)
        controls.dispose()
        renderer.dispose()
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement)
        }
      }
    }

    setContext(ctx)

    return () => {
      console.log('Disposing Three.js context')
      ctx.dispose()
      setContext(null)
    }
  }, [])

  return context
}

export default function LidarViewer({ fileUrl, onError }: LidarViewerProps) {
  const [context, setContext] = useState<ThreeContext | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    progress: 0,
    error: null
  })

  // Store initial camera position for reset
  const initialCameraPosition = useRef<THREE.Vector3 | null>(null)

  // Convert containerRef from callback to useRef
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize Three.js context
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    console.log('Creating Three.js context')
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    )
    camera.position.set(0, 5, 10)
    initialCameraPosition.current = camera.position.clone()

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = true
    controls.minDistance = 0.1
    controls.maxDistance = 1000

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
    scene.add(gridHelper)

    let animationFrameId: number

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    const ctx: ThreeContext = {
      scene,
      camera,
      renderer,
      controls,
      pointCloud: null,
      dispose: () => {
        cancelAnimationFrame(animationFrameId)
        controls.dispose()
        renderer.dispose()
        if (container && renderer.domElement) {
          container.removeChild(renderer.domElement)
        }
      }
    }

    setContext(ctx)

    return () => {
      console.log('Disposing Three.js context')
      ctx.dispose()
      setContext(null)
    }
  }, [])

  // Cleanup effect with empty dependency array
  useEffect(() => {
    return () => {
      if (context) {
        console.log('Disposing Three.js context')
        context.dispose()
        setContext(null)
      }
    }
  }, [])

  // Load LiDAR data when context is ready
  useEffect(() => {
    if (!context || !fileUrl) {
      console.log('Waiting for context or file URL:', {
        hasContext: !!context,
        hasFileUrl: !!fileUrl
      })
      return
    }

    console.log('Starting LiDAR data load...')

    async function loadLidarData() {
      try {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }))

        // Get file from Firebase
        console.log('Fetching file from Firebase:', fileUrl)
        const storagePath = decodeURIComponent(fileUrl).split('/o/')[1]?.split('?')[0]
        if (!storagePath) throw new Error('Invalid storage path')

        const fileRef = ref(storage, storagePath)
        const blob = await getBlob(fileRef)
        const arrayBuffer = await blob.arrayBuffer()
        console.log('File fetched, size:', arrayBuffer.byteLength)

        // Parse LiDAR data
        console.log('Parsing LiDAR data...')
        const parsedData = await load(arrayBuffer, LASLoader, {
          fetch: {
            // @ts-ignore - loaders.gl internal fetch options type is incomplete
            onProgress: (progressEvent: ProgressEvent) => {
              const progress = progressEvent.loaded / progressEvent.total
              setLoadingState(prev => ({ ...prev, progress }))
            }
          },
          las: {
            skip: arrayBuffer.byteLength > 100000000 ? 2 : 1,
            fp64: false
          }
        })

        // Create point cloud
        console.log('Creating point cloud...')
        const positions = new Float32Array(parsedData.attributes.POSITION.value)
        const colors = new Float32Array(positions.length)
        
        let minZ = Infinity, maxZ = -Infinity
        for (let i = 2; i < positions.length; i += 3) {
          minZ = Math.min(minZ, positions[i])
          maxZ = Math.max(maxZ, positions[i])
        }

        const color = new THREE.Color()
        for (let i = 0; i < positions.length; i += 3) {
          const z = positions[i + 2]
          const normalizedZ = (z - minZ) / (maxZ - minZ)
          color.setHSL(0.6 - normalizedZ * 0.5, 1.0, 0.5)
          colors[i] = color.r
          colors[i + 1] = color.g
          colors[i + 2] = color.b
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
          size: 0.02,
          vertexColors: true,
          sizeAttenuation: true
        })

        const pointCloud = new THREE.Points(geometry, material)
        if (!context) return
        context.scene.add(pointCloud)
        context.pointCloud = pointCloud

        // Update camera
        const box = new THREE.Box3().setFromObject(pointCloud)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        const maxDim = Math.max(...size.toArray())
        if (!context.camera) return
        const fov = context.camera.fov * (Math.PI / 180)
        const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2) / 2)
        
        context.camera.position.copy(center.clone().add(new THREE.Vector3(0, 0, cameraDistance)))
        context.controls.target.copy(center)
        context.controls.update()

        setLoadingState(prev => ({ ...prev, isLoading: false }))
        console.log('LiDAR data loaded successfully')

      } catch (error) {
        console.error('Error loading LiDAR data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unable to load LiDAR data'
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage
        }))
        onError?.(errorMessage)
      }
    }

    loadLidarData()
  }, [context, fileUrl, onError])

  // Viewer control functions
  const zoomIn = useCallback(() => {
    if (context?.camera) {
      context.camera.position.multiplyScalar(0.9)
      context.controls.update()
    }
  }, [context])

  const zoomOut = useCallback(() => {
    if (context?.camera) {
      context.camera.position.multiplyScalar(1.1)
      context.controls.update()
    }
  }, [context])

  // Fix reset function to use stored initial position
  const reset = useCallback(() => {
    if (context?.camera && initialCameraPosition.current) {
      context.camera.position.copy(initialCameraPosition.current)
      context.controls.reset()
      context.controls.update()
    }
  }, [context])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Make controls available to parent
  useEffect(() => {
    if (containerRef.current) {
      // @ts-ignore - Adding custom property to DOM element
      containerRef.current.viewerControls = {
        zoomIn,
        zoomOut,
        reset,
        toggleFullscreen
      } as ViewerControls
    }
  }, [zoomIn, zoomOut, reset, toggleFullscreen])

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[400px]"
        style={{ 
          position: 'relative',
          backgroundColor: '#000'
        }}
      />

      {loadingState.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-white">Loading LiDAR data...</p>
            {loadingState.progress > 0 && (
              <p className="text-white/70">{Math.round(loadingState.progress * 100)}%</p>
            )}
          </div>
        </div>
      )}

      {loadingState.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <h3 className="text-red-500 font-semibold">Error Loading LiDAR Data</h3>
            <p className="text-white/70 text-sm">{loadingState.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
        Use mouse to rotate • Scroll to zoom • Right-click to pan
      </div>
    </div>
  )
}
