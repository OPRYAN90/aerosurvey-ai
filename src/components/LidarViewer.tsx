"use client"

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader'
import { storage } from '@/lib/firebase'
import { ref, getBlob } from 'firebase/storage'

interface LidarViewerProps {
  fileUrl: string
}

export default function LidarViewer({ fileUrl }: LidarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    progress: number;
    error: string | null;
  }>({
    isLoading: true,
    progress: 0,
    error: null
  })

  useEffect(() => {
    if (!containerRef.current || !fileUrl) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 5, 10)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const loadLidarData = async () => {
      try {
        setLoadingState(prev => ({ ...prev, isLoading: true, error: null }))
        
        // Get file path from Firebase URL
        const storagePath = decodeURIComponent(fileUrl).split('/o/')[1]?.split('?')[0]
        if (!storagePath) throw new Error('Invalid storage path')

        // Get blob from Firebase
        const fileRef = ref(storage, storagePath)
        const blob = await getBlob(fileRef)
        const arrayBuffer = await blob.arrayBuffer()

        // Convert LAS/LAZ to PCD format (you'll need to implement this conversion)
        // For now, we'll create a simple point cloud from the raw data
        const points = new Float32Array(arrayBuffer.slice(0, 1000000)) // Limit size for testing
        const geometry = new THREE.BufferGeometry()
        
        // Create positions from the raw data
        const positions = []
        for (let i = 0; i < points.length; i += 3) {
          positions.push(points[i], points[i + 1], points[i + 2])
        }
        
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(positions, 3)
        )

        // Create colors based on height
        const colors = new Float32Array(positions.length)
        const color = new THREE.Color()
        for (let i = 0; i < positions.length; i += 3) {
          const height = positions[i + 2]
          color.setHSL(0.6 - height * 0.5, 1.0, 0.5)
          colors[i] = color.r
          colors[i + 1] = color.g
          colors[i + 2] = color.b
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
          size: 0.02,
          vertexColors: true,
          sizeAttenuation: true
        })

        const pointCloud = new THREE.Points(geometry, material)
        scene.add(pointCloud)

        // Center and scale view
        const box = new THREE.Box3().setFromObject(pointCloud)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        camera.position.copy(center)
        camera.position.z += Math.max(...size.toArray()) * 2
        controls.target.copy(center)
        controls.update()

        setLoadingState(prev => ({ ...prev, isLoading: false }))

      } catch (error) {
        console.error('Error loading LiDAR data:', error)
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        }))
      }
    }

    loadLidarData()

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
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
