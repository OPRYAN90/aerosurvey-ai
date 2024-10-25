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

export default function LidarViewer({ fileUrl, onError }: LidarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)
  const initialCameraPositionRef = useRef<THREE.Vector3 | null>(null)
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    progress: 0,
    error: null
  })

  // Add new refs
  const isMountedRef = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Viewer control functions
  const zoomIn = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.9)
      controlsRef.current?.update()
    }
  }, [])

  const zoomOut = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.1)
      controlsRef.current?.update()
    }
  }, [])

  const reset = useCallback(() => {
    if (cameraRef.current && controlsRef.current && initialCameraPositionRef.current) {
      cameraRef.current.position.copy(initialCameraPositionRef.current)
      controlsRef.current.reset()
      controlsRef.current.update()
    }
  }, [])

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

  // Scene setup effect
  useEffect(() => {
    console.log('Initializing Three.js scene...')
    if (!containerRef.current) {
      console.log('Container ref not ready')
      return
    }

    try {
      // Scene setup
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)
      sceneRef.current = scene
      console.log('Scene created')

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        2000
      )
      camera.position.set(0, 5, 10)
      cameraRef.current = camera
      initialCameraPositionRef.current = camera.position.clone()
      console.log('Camera initialized')

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
      containerRef.current.appendChild(renderer.domElement)
      rendererRef.current = renderer
      console.log('Renderer created')

      // Controls setup
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = true
      controls.minDistance = 0.1
      controls.maxDistance = 1000
      controlsRef.current = controls
      console.log('Controls initialized')

      // Animation loop
      let animationFrameId: number
      const animate = () => {
        if (!isMountedRef.current) return
        animationFrameId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Mark as initialized
      setIsInitialized(true)
      isMountedRef.current = true
      console.log('Three.js initialization complete')

      return () => {
        console.log('Cleaning up Three.js resources')
        isMountedRef.current = false
        cancelAnimationFrame(animationFrameId)
        controls.dispose()
        renderer.dispose()
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement)
        }
        setIsInitialized(false)
      }
    } catch (error) {
      console.error('Error during Three.js initialization:', error)
      onError?.(error instanceof Error ? error.message : 'Failed to initialize viewer')
    }
  }, [onError])

  // LiDAR data loading effect
  useEffect(() => {
    if (!isInitialized || !fileUrl || !isMountedRef.current) {
      console.log('Waiting for initialization...', {
        isInitialized,
        hasFileUrl: !!fileUrl,
        isMounted: isMountedRef.current
      })
      return
    }

    console.log('Starting LiDAR data load...')
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) {
      console.error('Required refs not initialized:', {
        hasScene: !!sceneRef.current,
        hasCamera: !!cameraRef.current,
        hasControls: !!controlsRef.current
      })
      return
    }

    const loadLidarData = async () => {
      try {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }))
        
        console.log('Fetching LiDAR file from Firebase...')
        const storagePath = decodeURIComponent(fileUrl).split('/o/')[1]?.split('?')[0]
        if (!storagePath) throw new Error('Invalid storage path')
        
        const fileRef = ref(storage, storagePath)
        const blob = await getBlob(fileRef)
        const arrayBuffer = await blob.arrayBuffer()
        console.log('File fetched, size:', arrayBuffer.byteLength)

        // Check file signature
        const signature = new TextDecoder().decode(arrayBuffer.slice(0, 4))
        console.log('File signature:', signature)
        
        if (signature !== 'LASF') {
          throw new Error('Invalid LAS/LAZ file format')
        }

        const parsedData = await load(arrayBuffer, LASLoader, {
          las: {
            skip: arrayBuffer.byteLength > 100000000 ? 2 : 1, // Skip more points for large files
            fp64: false
          },
          onProgress: (progress: number) => {
            setLoadingState(prev => ({ ...prev, progress }))
          }
        })

        // Clear existing point cloud
        if (pointCloudRef.current && sceneRef.current) {
          sceneRef.current.remove(pointCloudRef.current)
          pointCloudRef.current.geometry.dispose()
          if (pointCloudRef.current.material instanceof THREE.Material) {
            pointCloudRef.current.material.dispose()
          }
        }

        // Process points
        const positions = new Float32Array(parsedData.attributes.POSITION.value)
        const colors = new Float32Array(positions.length)
        
        let minZ = Infinity
        let maxZ = -Infinity
        
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
        sceneRef.current.add(pointCloud)
        pointCloudRef.current = pointCloud

        // Update camera
        const box = new THREE.Box3().setFromObject(pointCloud)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        const maxDim = Math.max(...size.toArray())
        const fov = cameraRef.current.fov * (Math.PI / 180)
        const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2) / 2)
        
        const newPosition = center.clone()
        newPosition.z += cameraDistance
        
        cameraRef.current.position.copy(newPosition)
        initialCameraPositionRef.current = newPosition.clone()
        controlsRef.current.target.copy(center)
        controlsRef.current.update()

        setLoadingState(prev => ({ ...prev, isLoading: false }))

        console.log('LiDAR data load complete')
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
  }, [fileUrl, isInitialized, onError])

  if (loadingState.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-white">Loading LiDAR data...</p>
          {loadingState.progress > 0 && (
            <p className="text-white/70">{Math.round(loadingState.progress * 100)}%</p>
          )}
        </div>
      </div>
    )
  }

  if (loadingState.error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
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
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
        Use mouse to rotate • Scroll to zoom • Right-click to pan
      </div>
    </div>
  )
}
