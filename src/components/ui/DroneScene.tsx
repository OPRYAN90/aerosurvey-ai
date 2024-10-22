"use client"

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, SpotLight, useDepthBuffer, Stars } from '@react-three/drei'

export function DroneScene({ isAnimating }: { isAnimating: boolean }) {
  const droneGroup = useRef<THREE.Group>(null)
  const rotorsRef = useRef<THREE.Mesh[]>([])
  const scanPointsRef = useRef<number[]>([])
  const scanIntensitiesRef = useRef<number[]>([])
  const scanGeometryRef = useRef(new THREE.BufferGeometry())
  const frame = useRef(0)
  const depthBuffer = useDepthBuffer({ frames: 1 })
  const { camera } = useThree()

  // Update initial camera position for better default view
  useEffect(() => {
    camera.position.set(0, 12, 24)
    camera.lookAt(0, 3, 0)
  }, [camera])

  // Materials remain the same as previous implementation...
  const materials = useMemo(() => ({
    // ... (previous materials implementation)
  }), [])

  // Modified drone path for better visibility
  const dronePath = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-15, 6, -15),
      new THREE.Vector3(-15, 8, 0),
      new THREE.Vector3(0, 7, 15),
      new THREE.Vector3(15, 8, 0),
      new THREE.Vector3(15, 6, -15),
      new THREE.Vector3(0, 7, -20),
    ], true)
    
    return curve
  }, [])

  // Animation loop with improved camera tracking
  useFrame((state) => {
    if (!isAnimating || !droneGroup.current) return
    frame.current++

    // Smoother drone movement along path
    const time = (frame.current * 0.001) % 1
    const position = dronePath.getPointAt(time)
    const lookAhead = dronePath.getPointAt((time + 0.01) % 1)
    
    if (droneGroup.current) {
      // Update drone position
      droneGroup.current.position.copy(position)
      
      // Calculate direction vector
      const direction = new THREE.Vector3()
      direction.subVectors(lookAhead, position).normalize()
      
      // Add slight hover effect
      droneGroup.current.position.y += Math.sin(frame.current * 0.05) * 0.2
      
      // Smooth drone rotation
      const targetRotation = Math.atan2(direction.x, direction.z)
      const currentRotation = droneGroup.current.rotation.y
      droneGroup.current.rotation.y = targetRotation
      
      // Bank angle based on turning
      const turnRate = direction.cross(new THREE.Vector3(0, 1, 0)).y
      droneGroup.current.rotation.z = -turnRate * 0.5
      
      // Pitch based on vertical movement
      const verticalSpeed = lookAhead.y - position.y
      droneGroup.current.rotation.x = verticalSpeed * 0.5
    }

    // Rotor animation with varying speeds
    rotorsRef.current.forEach((rotor, i) => {
      if (rotor) {
        const baseSpeed = 1.2
        const speedVariation = Math.sin(frame.current * 0.02) * 0.2
        rotor.rotation.y += (i % 2 ? baseSpeed + speedVariation : -(baseSpeed + speedVariation))
      }
    })

    // Update LiDAR scan points
    updateScanPoints(position)
  })

  // Enhanced LiDAR scanning effect
  const updateScanPoints = (dronePosition: THREE.Vector3) => {
    const scanRadius = 12
    const scanLayers = 24
    const pointsPerLayer = 48

    for (let layer = 0; layer < scanLayers; layer++) {
      const verticalAngle = (layer / scanLayers) * Math.PI / 3 - Math.PI / 6
      const layerRadius = scanRadius * Math.cos(verticalAngle)
      const layerHeight = scanRadius * Math.sin(verticalAngle)

      for (let point = 0; point < pointsPerLayer; point++) {
        const angle = (point / pointsPerLayer) * Math.PI * 2
        const x = dronePosition.x + Math.cos(angle) * layerRadius
        const y = dronePosition.y + layerHeight
        const z = dronePosition.z + Math.sin(angle) * layerRadius

        // Calculate scan intensity based on distance and angle
        const distance = new THREE.Vector3(x, y, z)
          .sub(dronePosition)
          .length()
        const intensity = Math.max(0, 1 - (distance / scanRadius))

        scanPointsRef.current.push(x, y, z)
        scanIntensitiesRef.current.push(intensity)
      }
    }

    // Limit points for performance
    const maxPoints = 24576
    if (scanPointsRef.current.length > maxPoints * 3) {
      scanPointsRef.current = scanPointsRef.current.slice(-maxPoints * 3)
      scanIntensitiesRef.current = scanIntensitiesRef.current.slice(-maxPoints)
    }

    // Update geometry attributes
    scanGeometryRef.current.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(scanPointsRef.current, 3)
    )
    scanGeometryRef.current.setAttribute(
      'intensity',
      new THREE.Float32BufferAttribute(scanIntensitiesRef.current, 1)
    )
  }

  return (
    <>
      <color attach="background" args={[0x000000]} />
      <fog attach="fog" args={[0x000000, 30, 100]} />

      {/* Improved lighting setup */}
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[20, 30, 20]} 
        intensity={0.7} 
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Additional fill light for better visibility */}
      <directionalLight
        position={[-10, 20, -10]}
        intensity={0.3}
        color={0x4466ff}
      />

      {/* Drone spotlight */}
      <SpotLight
        position={[0, 10, 0]}
        angle={0.4}
        penumbra={0.3}
        intensity={1.5}
        distance={25}
        castShadow
        depthBuffer={depthBuffer}
        color={0x4444ff}
      />

      {/* Ground with grid */}
      <group position-y={-0.01}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial 
            color={0x111111}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
        <gridHelper args={[100, 100, 0x333333, 0x222222]} />
      </group>

      {/* Main road */}
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[10, 80]} />
        <meshStandardMaterial 
          color={0x202020}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>

      {/* Road markings */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh 
          key={i}
          rotation-x={-Math.PI / 2}
          position-y={0.01}
          position-z={i * 4 - 40}
        >
          <planeGeometry args={[0.2, 2]} />
          <meshStandardMaterial 
            color={0xffff00}
            emissive={0xffff00}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Drone group */}
      <group ref={droneGroup}>
        {/* Drone body */}
        <mesh castShadow>
          <boxGeometry args={[1, 0.2, 1]} />
          <meshStandardMaterial 
            color={0x2c3e50}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Drone arms and rotors */}
        {[[-0.6, -0.6], [-0.6, 0.6], [0.6, -0.6], [0.6, 0.6]].map((pos, i) => (
          <group key={i} position={[pos[0], 0, pos[1]]}>
            <mesh castShadow>
              <boxGeometry args={[0.1, 0.05, 0.8]} />
              <meshStandardMaterial color={0x2c3e50} />
            </mesh>
            
            <mesh 
              ref={(el) => { if (el) rotorsRef.current[i] = el }}
              position-y={0.05}
              castShadow
            >
              <cylinderGeometry args={[0.4, 0.4, 0.05, 32]} />
              <meshStandardMaterial color={0x95a5a6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* LiDAR visualization */}
      <points>
        <primitive object={scanGeometryRef.current} />
        <pointsMaterial
          size={2}
          vertexColors
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>

      {/* Enhanced camera controls */}
      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        panSpeed={0.8}
        target={[0, 3, 0]}
        screenSpacePanning={true}
      />

      {/* Background stars */}
      <Stars 
        radius={50} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0}
        fade
      />
    </>
  )
}
