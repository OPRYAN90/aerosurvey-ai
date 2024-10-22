"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from '@react-three/drei';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, BarChart2, Database, Cpu } from 'lucide-react'

export default function Homepage() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x000000, 10, 50)
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(5, 5, 10)
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000)
    renderer.shadowMap.enabled = true
    mountRef.current.appendChild(renderer.domElement)
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)
    
    // Road
    const roadGeometry = new THREE.PlaneGeometry(20, 100, 20, 100)
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
    })
    const road = new THREE.Mesh(roadGeometry, roadMaterial)
    road.rotation.x = -Math.PI / 2
    road.receiveShadow = true
    scene.add(road)

    // Add road markings
    const lineGeometry = new THREE.BoxGeometry(0.2, 20, 0.01)
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const line = new THREE.Mesh(lineGeometry, lineMaterial)
    line.rotation.x = -Math.PI / 2
    line.position.y = 0.01
    scene.add(line)
    
    // Drone body
    const droneGroup = new THREE.Group()
    
    const bodyGeometry = new THREE.BoxGeometry(1, 0.2, 1)
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 })
    const droneBody = new THREE.Mesh(bodyGeometry, bodyMaterial)
    droneGroup.add(droneBody)
    
    // Drone arms
    const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 1.2)
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(armGeometry, bodyMaterial)
      arm.position.x = i < 2 ? -0.5 : 0.5
      arm.position.z = i % 2 === 0 ? -0.5 : 0.5
      droneGroup.add(arm)
    }
    
    // Drone rotors
    const rotorGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32)
    const rotorMaterial = new THREE.MeshPhongMaterial({ color: 0x95a5a6 })
    const rotorPositions = [
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.5, -0.5],
      [0.5, 0.5]
    ]
    
    const rotors = rotorPositions.map(([x, z]) => {
      const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial)
      rotor.position.set(x, 0.1, z)
      droneGroup.add(rotor)
      return rotor
    })
    
    droneGroup.position.set(0, 4, 0)
    scene.add(droneGroup)
    
    // LiDAR scan effect
    const scanGeometry = new THREE.BufferGeometry()
    const scanMaterial = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6
    })
    
    const scanPoints: number[] = []
    const pointCloud = new THREE.Points(scanGeometry, scanMaterial)
    scene.add(pointCloud)
    
    // Animation
    let frame = 0
    const animate = () => {
      if (isAnimating) {
        frame++
        
        // Drone movement
        droneGroup.position.z = Math.sin(frame * 0.02) * 5
        droneGroup.rotation.y = Math.sin(frame * 0.01) * 0.1
        
        // Rotor rotation
        rotors.forEach((rotor, i) => {
          rotor.rotation.y = frame * (i % 2 ? 0.5 : -0.5)
        })
        
        // LiDAR scan effect
        if (frame % 5 === 0) {
          const scanX = droneGroup.position.x + (Math.random() - 0.5) * 4
          const scanZ = droneGroup.position.z + (Math.random() - 0.5) * 4
          scanPoints.push(scanX, 0, scanZ)
          
          if (scanPoints.length > 3000) {
            scanPoints.splice(0, 3)
          }
          
          scanGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(scanPoints, 3)
          )
        }
        
        controls.update()
        renderer.render(scene, camera)
      }
      requestAnimationFrame(animate)
    }
    
    animate()
    
    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      mountRef.current?.removeChild(renderer.domElement)
    }
  }, [isAnimating])

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-black to-gray-900 text-white overflow-hidden">
      <div className="absolute inset-0" ref={mountRef} aria-hidden="true">
        <Button
          className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm hover:bg-white/20"
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? 'Pause' : 'Play'}
        </Button>
      </div>
      <div className="relative z-10 container mx-auto px-4 py-16 flex flex-col h-full justify-between">
        <header>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">LiDAR AI Explorer</h1>
          <p className="text-xl md:text-2xl mb-8">Revolutionizing data processing with AI and LiDAR technology</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <Card className="bg-white/10 backdrop-blur-sm border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart2 className="mr-2" />
                Data Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Advanced algorithms for real-time LiDAR data processing and visualization.</CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2" />
                Big Data Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Efficient storage and retrieval of massive LiDAR datasets for quick access and analysis.</CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Cpu className="mr-2" />
                AI-Powered Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Machine learning models that extract meaningful patterns and predictions from LiDAR data.</CardDescription>
            </CardContent>
          </Card>
        </div>
        <div className="text-center">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Explore Our Solutions <ChevronRight className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
