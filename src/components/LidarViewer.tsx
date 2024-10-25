"use client"

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { LASLoader } from '@loaders.gl/las'
import { load } from '@loaders.gl/core'
import { storage } from '@/lib/firebase'
import { ref, getBlob } from 'firebase/storage'

interface LidarViewerProps {
  fileUrl?: string  // Make fileUrl optional
}

export default function LidarViewer({ fileUrl }: LidarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)

  useEffect(() => {
    if (!containerRef.current || !fileUrl) return  // Add fileUrl check

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0x000000)

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    cameraRef.current = camera
    camera.position.z = 5

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    rendererRef.current = renderer
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)

    // Initialize controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Modified Load LiDAR data function
    const loadLidarData = async () => {
      try {
        // Extract the path from the Firebase Storage URL
        const storagePath = decodeURIComponent(fileUrl)
          .split('/o/')[1]
          ?.split('?')[0]
          ?.replace(/%2F/g, '/');

        if (!storagePath) {
          throw new Error('Invalid storage path');
        }

        // Get a reference to the file and download it as a blob
        const fileRef = ref(storage, storagePath);
        const blob = await getBlob(fileRef);
        const arrayBuffer = await blob.arrayBuffer();
        
        // Parse LAS/LAZ file
        const parsedData = await load(arrayBuffer, LASLoader, {
          worker: true,
          maxConcurrency: 4
        });
        
        // Create geometry from parsed data
        const geometry = new THREE.BufferGeometry();
        
        // Ensure positions exist and are in the correct format
        if (!parsedData.attributes || !parsedData.attributes.POSITION) {
          throw new Error('No position data found in LiDAR file');
        }
        
        const positions = new Float32Array(parsedData.attributes.POSITION.value);
        
        // Handle colors if they exist, otherwise create default colors
        let colors;
        if (parsedData.attributes.COLOR_0) {
          colors = new Float32Array(parsedData.attributes.COLOR_0.value);
        } else {
          // Create default color (white) for all points
          colors = new Float32Array(positions.length);
          for (let i = 0; i < colors.length; i++) {
            colors[i] = 1.0; // White color (1.0, 1.0, 1.0)
          }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create point cloud material with improved settings
        const material = new THREE.PointsMaterial({
          size: 0.005,
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.8
        });
        
        // Remove existing point cloud if it exists
        if (pointCloudRef.current) {
          scene.remove(pointCloudRef.current);
        }
        
        // Create and add new point cloud
        const pointCloud = new THREE.Points(geometry, material);
        pointCloudRef.current = pointCloud;
        scene.add(pointCloud);
        
        // Center and scale view
        const box = new THREE.Box3().setFromObject(pointCloud);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Position camera to show full point cloud
        const maxDim = Math.max(...size.toArray());
        camera.position.copy(center);
        camera.position.z += maxDim * 2;
        controls.target.copy(center);
        controls.update();
        
      } catch (error) {
        console.error('Error loading LiDAR data:', error);
      }
    };

    loadLidarData();

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
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [fileUrl])

  if (!fileUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40">
        <p className="text-white/70">No file URL provided</p>
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
