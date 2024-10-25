"use client"

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { parse } from '@loaders.gl/core'
import { LASLoader } from '@loaders.gl/las'
import { Load } from '@loaders.gl/core'
import { storage } from '@/lib/firebase'
import { ref, getDownloadURL } from 'firebase/storage'

interface LidarViewerProps {
  fileUrl: string
}

export default function LidarViewer({ fileUrl }: LidarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !fileUrl) return

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let controls: OrbitControls
    let pointCloud: THREE.Points

    const init = async () => {
      try {
        // Initialize Three.js
        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x000000)

        camera = new THREE.PerspectiveCamera(
          75,
          containerRef.current!.clientWidth / containerRef.current!.clientHeight,
          0.1,
          1000
        )
        camera.position.set(0, 0, 5)

        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight)
        containerRef.current!.appendChild(renderer.domElement)

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true

        // Fetch and parse LiDAR data
        const response = await fetch(fileUrl)
        const arrayBuffer = await response.arrayBuffer()

        const parsedData = await parse(arrayBuffer, LASLoader, {
          laszip: {},
          options: {
            skip: 1,
            maxPoints: 1000000
          }
        })

        // Create point cloud
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(parsedData.attributes.POSITION.value)
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        // Color points based on elevation
        const colors = new Float32Array(positions.length)
        const color = new THREE.Color()
        for (let i = 0; i < positions.length; i += 3) {
          const elevation = positions[i + 2]
          color.setHSL(0.6 - elevation * 0.5, 1.0, 0.5)
          colors[i] = color.r
          colors[i + 1] = color.g
          colors[i + 2] = color.b
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
          size: 0.01,
          vertexColors: true,
          sizeAttenuation: true
        })

        pointCloud = new THREE.Points(geometry, material)
        scene.add(pointCloud)

        // Center camera on point cloud
        const box = new THREE.Box3().setFromObject(pointCloud)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        camera.position.copy(center)
        camera.position.z += maxDim * 2
        controls.target.copy(center)

        setIsLoading(false)
      } catch (err: unknown) {
        console.error('Error loading LiDAR data:', err)
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
        setIsLoading(false)
      }
    }

    const animate = () => {
      requestAnimationFrame(animate)
      controls?.update()
      renderer?.render(scene, camera)
    }

    init()
    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current && renderer) {
        containerRef.current.removeChild(renderer.domElement)
      }
      controls?.dispose()
      renderer?.dispose()
    }
  }, [fileUrl])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
        <div className="text-white space-y-2 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"/>
          <p>Loading LiDAR data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
        <div className="text-red-500 space-y-2 text-center p-4">
          <p className="font-semibold">Error loading LiDAR data</p>
          <p className="text-sm text-white/70">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-md text-sm">
        Click and drag to rotate • Scroll to zoom
      </div>
    </div>
  )
}
