"use client"

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { storage } from '@/lib/firebase'
import { ref, getBlob } from 'firebase/storage'

interface LidarViewerProps {
  fileUrl: string
}

interface LoadingState {
  isLoading: boolean
  progress: number
  error: string | null
}

export default function LidarViewer({ fileUrl }: LidarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    progress: 0,
    error: null
  })

  // Setup Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    // Initialize scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 5, 10)

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Animation loop
    let animationFrameId: number

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      controls.dispose()
      renderer.dispose()
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Handle file loading
  useEffect(() => {
    if (!fileUrl || !sceneRef.current) return

    const loadLidarData = async () => {
      try {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }))
        
        // Get file path
        const storagePath = decodeURIComponent(fileUrl).split('/o/')[1]?.split('?')[0]
        if (!storagePath) throw new Error('Invalid storage path')

        // Get file from Firebase
        const fileRef = ref(storage, storagePath)
        const blob = await getBlob(fileRef)
        const arrayBuffer = await blob.arrayBuffer()

        // Remove existing point cloud if any
        if (pointCloudRef.current) {
          sceneRef.current.remove(pointCloudRef.current)
          pointCloudRef.current.geometry.dispose()
          pointCloudRef.current.material.dispose()
        }

        // Process point cloud data
        const dataView = new DataView(arrayBuffer)
        const points: number[] = []
        const colors: number[] = []
        
        // Sample points from the buffer
        for (let i = 0; i < Math.min(arrayBuffer.byteLength, 1000000); i += 12) {
          if (i + 11 >= arrayBuffer.byteLength) break
          
          const x = dataView.getFloat32(i, true)
          const y = dataView.getFloat32(i + 4, true)
          const z = dataView.getFloat32(i + 8, true)
          
          if (isFinite(x) && isFinite(y) && isFinite(z)) {
            points.push(x, y, z)
            
            // Generate color based on height
            const normalizedHeight = (z + 10) / 20
            const color = new THREE.Color()
            color.setHSL(0.6 - normalizedHeight * 0.5, 1.0, 0.5)
            colors.push(color.r, color.g, color.b)
          }
        }

        // Create geometry
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

        // Create material
        const material = new THREE.PointsMaterial({
          size: 0.02,
          vertexColors: true,
          sizeAttenuation: true
        })

        // Create point cloud
        const pointCloud = new THREE.Points(geometry, material)
        sceneRef.current.add(pointCloud)
        pointCloudRef.current = pointCloud

        setLoadingState(prev => ({ ...prev, isLoading: false }))

      } catch (error) {
        console.error('Error loading LiDAR data:', error)
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error 
            ? error.message 
            : 'Unable to load LiDAR data. Please try again later.'
        }))
      }
    }

    loadLidarData()
  }, [fileUrl])

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
